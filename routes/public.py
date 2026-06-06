from flask import Blueprint, render_template, send_from_directory
from models import db, Puzzle

public_bp = Blueprint('public', __name__)


@public_bp.route('/js/<path:filename>')
def serve_js(filename):
    return send_from_directory('js', filename)


@public_bp.route('/styles.css')
def serve_css():
    return send_from_directory('.', 'styles.css')


@public_bp.route('/')
def puzzle_list():
    puzzles = Puzzle.query.order_by(Puzzle.created_at.desc()).all()
    return render_template('list.html', puzzles=puzzles)


@public_bp.route('/play/<int:puzzle_id>')
def play(puzzle_id):
    puzzle = db.get_or_404(Puzzle, puzzle_id)
    return render_template('player.html', puzzle=puzzle)
