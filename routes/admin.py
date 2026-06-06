import json
import os
from functools import wraps

from flask import (Blueprint, current_app, flash, jsonify, redirect,
                   render_template, request, session, url_for)
from models import db, Puzzle

admin_bp = Blueprint('admin', __name__, url_prefix='/admin')


def require_admin(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get('admin'):
            return redirect(url_for('admin.admin_login'))
        return f(*args, **kwargs)
    return decorated


def _parse_coordinates(data):
    coords = data.get('coordinates') if isinstance(data, dict) else None
    if isinstance(coords, dict):
        try:
            return float(coords['x']), float(coords['y'])
        except (KeyError, TypeError, ValueError):
            pass
    return None, None


def _parse_puzzle_json(data):
    if isinstance(data, list):
        return data, None, None, None, None
    if isinstance(data, dict) and isinstance(data.get('bars'), list):
        coord_x, coord_y = _parse_coordinates(data)
        return data['bars'], data.get('name') or None, data.get('description') or None, coord_x, coord_y
    return None, None, None, None, None


def _puzzle_to_dict(puzzle):
    d = {'name': puzzle.name, 'bars': puzzle.data}
    if puzzle.description:
        d['description'] = puzzle.description
    if puzzle.coordinates_x is not None and puzzle.coordinates_y is not None:
        d['coordinates'] = {'x': puzzle.coordinates_x, 'y': puzzle.coordinates_y}
    return d


def _validate_puzzle(name, bars):
    if not name:
        return 'Name is required.'
    if not isinstance(bars, list) or not (3 <= len(bars) <= 8):
        return 'Puzzle must have 3–8 bars.'
    n = len(bars)
    for i, bar in enumerate(bars):
        if not isinstance(bar, dict):
            return f'Bar {i} is not a valid object.'
        pos = bar.get('position')
        if not isinstance(pos, int) or not (-3 <= pos <= 3):
            return f'Bar {i} position must be an integer in [-3, 3].'
        conns = bar.get('connections')
        if not isinstance(conns, list) or len(conns) != n:
            return f'Bar {i} connections must be a list of length {n}.'
        if conns[i] != 1:
            return f'Bar {i} must have connections[{i}] = 1.'
        for j, v in enumerate(conns):
            if v not in (-1, 0, 1):
                return f'Bar {i} connections[{j}] must be -1, 0, or 1.'
    return None


@admin_bp.route('/login', methods=['GET', 'POST'])
def admin_login():
    error = None
    if request.method == 'POST':
        if (request.form.get('username') == os.environ['ADMIN_USER'] and
                request.form.get('password') == os.environ['ADMIN_PASS']):
            session['admin'] = True
            return redirect(url_for('admin.admin_index'))
        error = 'Invalid credentials.'
    return render_template('admin/login.html', error=error)


@admin_bp.route('/logout')
def admin_logout():
    session.pop('admin', None)
    return redirect(url_for('public.puzzle_list'))


@admin_bp.route('/', strict_slashes=False)
@require_admin
def admin_index():
    puzzles = Puzzle.query.order_by(Puzzle.created_at.desc()).all()
    return render_template('admin/list.html', puzzles=puzzles)


@admin_bp.route('/puzzles/new', methods=['GET', 'POST'])
@require_admin
def admin_puzzle_new():
    if request.method == 'POST':
        data = request.get_json(silent=True) or {}
        name = (data.get('name') or '').strip()
        description = (data.get('description') or '').strip() or None
        bars = data.get('bars')
        coord_x, coord_y = _parse_coordinates(data)
        err = _validate_puzzle(name, bars)
        if err:
            return jsonify({'error': err}), 400
        puzzle = Puzzle(name=name, description=description, data=bars,
                        coordinates_x=coord_x, coordinates_y=coord_y)
        db.session.add(puzzle)
        db.session.commit()
        return jsonify({'id': puzzle.id}), 201
    return render_template('admin/edit.html', puzzle=None)


@admin_bp.route('/puzzles/<int:puzzle_id>/edit', methods=['GET', 'POST'])
@require_admin
def admin_puzzle_edit(puzzle_id):
    puzzle = db.get_or_404(Puzzle, puzzle_id)
    if request.method == 'POST':
        data = request.get_json(silent=True) or {}
        name = (data.get('name') or '').strip()
        description = (data.get('description') or '').strip() or None
        bars = data.get('bars')
        coord_x, coord_y = _parse_coordinates(data)
        err = _validate_puzzle(name, bars)
        if err:
            return jsonify({'error': err}), 400
        puzzle.name = name
        puzzle.description = description
        puzzle.data = bars
        puzzle.coordinates_x = coord_x
        puzzle.coordinates_y = coord_y
        db.session.commit()
        return jsonify({'id': puzzle.id}), 200
    return render_template('admin/edit.html', puzzle=puzzle)


@admin_bp.route('/puzzles/<int:puzzle_id>/delete', methods=['POST'])
@require_admin
def admin_puzzle_delete(puzzle_id):
    puzzle = db.get_or_404(Puzzle, puzzle_id)
    db.session.delete(puzzle)
    db.session.commit()
    return redirect(url_for('admin.admin_index'))


@admin_bp.route('/puzzles/<int:puzzle_id>/export')
@require_admin
def admin_puzzle_export(puzzle_id):
    puzzle = db.get_or_404(Puzzle, puzzle_id)
    filename = puzzle.name.lower().replace(' ', '_') + '.json'
    payload = _puzzle_to_dict(puzzle)
    response = current_app.response_class(
        response=json.dumps(payload, indent=2),
        status=200,
        mimetype='application/json',
    )
    response.headers['Content-Disposition'] = f'attachment; filename="{filename}"'
    return response


@admin_bp.route('/puzzles/import', methods=['POST'])
@require_admin
def admin_puzzle_import():
    name = (request.form.get('name') or '').strip()
    file = request.files.get('file')

    if not name:
        flash('Name is required.', 'error')
        return redirect(url_for('admin.admin_index'))
    if not file or not file.filename:
        flash('No file provided.', 'error')
        return redirect(url_for('admin.admin_index'))

    try:
        raw = json.loads(file.read())
    except (json.JSONDecodeError, ValueError) as exc:
        flash(f'Invalid JSON: {exc}', 'error')
        return redirect(url_for('admin.admin_index'))

    bars, json_name, json_description, coord_x, coord_y = _parse_puzzle_json(raw)
    name = name or json_name or ''
    err = _validate_puzzle(name, bars)
    if err:
        flash(err, 'error')
        return redirect(url_for('admin.admin_index'))

    puzzle = Puzzle(name=name, description=json_description, data=bars,
                    coordinates_x=coord_x, coordinates_y=coord_y)
    db.session.add(puzzle)
    db.session.commit()
    flash(f'Imported "{name}".', 'success')
    return redirect(url_for('admin.admin_index'))
