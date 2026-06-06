// js/app.js — entry point, mode switching, glue.
// Modes: 'play' | 'edit' | 'solving'

import { loadPuzzle, canApplyMove, applyMove, resetPuzzle, isSolved,
         findViolatingBars, cloneState } from './state.js';
import { renderPuzzle, updatePuzzle, flashInvalid } from './render.js';
import { installControls, setCallbacks, setControlState,
         setEnabled, getSelectedBar } from './controls.js';
import { initIO, exportPuzzle } from './io.js';
import { enterEditMode } from './editor.js';
import { solve } from './solver.js';

let state = null;
let mode  = 'play';

const puzzleEl    = document.getElementById('puzzle');
const statusEl    = document.getElementById('status');
const editorPanel = document.getElementById('editor-panel');
const solverPanel = document.getElementById('solver-panel');
const ioPanel     = document.getElementById('io-panel');

// ── solver playback state ──────────────────────────────────────────────────

let solveState       = null;
let solveMoves       = null;
let solveStep        = 0;
let solveTimer       = null;
let solverMoveListEl = null;

// ── helpers ────────────────────────────────────────────────────────────────

function setStatus(msg) { statusEl.textContent = msg; }

function loadState(json) {
  state = loadPuzzle(json);
  renderPuzzle(state, puzzleEl);
  updatePuzzle(state, 0);
  setControlState(state);
  setStatus('');
}

function restorePlayMode() {
  setCallbacks(handlePlayMove, handlePlaySelect);
  if (state) {
    renderPuzzle(state, puzzleEl);
    updatePuzzle(state, getSelectedBar());
    setControlState(state);
  }
  setEnabled(true);
}

function setMode(m) {
  const prev = mode;
  mode = m;

  editorPanel.hidden = m !== 'edit';
  solverPanel.hidden = m !== 'solving';
  ioPanel.hidden     = true;
  document.body.dataset.mode = m;

  if (m !== 'solving') stopPlayback();

  if (m === 'play') {
    if (prev === 'edit') restorePlayMode();
    else setEnabled(true);
  } else {
    setEnabled(false);
  }
}

// ── play callbacks ─────────────────────────────────────────────────────────

function handlePlayMove(barIdx, dir) {
  if (!canApplyMove(state, barIdx, dir)) {
    findViolatingBars(state, barIdx, dir).forEach(i => flashInvalid(i));
    setStatus('Move blocked — bar would go out of bounds.');
    return;
  }
  applyMove(state, barIdx, dir);
  updatePuzzle(state, barIdx);
  setStatus('');
  if (isSolved(state)) {
    setStatus('Solved! All bars aligned.');
    setEnabled(false);
  }
}

function handlePlaySelect(barIdx) { updatePuzzle(state, barIdx); }

// ── solver playback ────────────────────────────────────────────────────────

// Returns per-step key strings, e.g. ["WA", "D", "SSA"] starting from bar 0.
function buildKeySequence(moves) {
  let cur = 0;
  return moves.map(({ barIdx, dir }) => {
    const delta = barIdx - cur;
    const nav   = delta > 0 ? 'W'.repeat(delta) : 'S'.repeat(-delta);
    cur = barIdx;
    return nav + (dir === 1 ? 'A' : 'D');
  });
}

function buildSolverPanel() {
  solverPanel.innerHTML = '';

  const btnPlay  = mkbtn('▶ Play');
  const btnPause = mkbtn('⏸ Pause');
  const btnFwd   = mkbtn('Step ▶');
  const btnBack  = mkbtn('◀ Step');
  const btnExit  = mkbtn('Exit solver');

  solverMoveListEl = document.createElement('ol');
  solverMoveListEl.className = 'solver-movelist';

  const keySteps = buildKeySequence(solveMoves);

  const seqEl = document.createElement('div');
  seqEl.className = 'solver-keyseq';
  seqEl.title = 'Full key sequence (starting from bar 0 selected)';
  seqEl.textContent = keySteps.join(' ');

  solverPanel.append(
    mkbar(btnBack, btnPlay, btnPause, btnFwd),
    el('br'),
    btnExit, el('br'), el('br'),
    seqEl, el('br'),
    solverMoveListEl,
  );

  solveMoves.forEach(({ barIdx, dir }, idx) => {
    const li    = document.createElement('li');
    const keys  = document.createElement('span');
    keys.className   = 'solver-step-keys';
    keys.textContent = keySteps[idx];
    const desc = document.createTextNode(` Bar ${barIdx} — ${dir === 1 ? 'left' : 'right'}`);
    li.dataset.step = idx;
    li.append(keys, desc);
    solverMoveListEl.appendChild(li);
  });

  btnPlay.addEventListener('click',  startPlayback);
  btnPause.addEventListener('click', stopPlayback);
  btnFwd.addEventListener('click',   stepForward);
  btnBack.addEventListener('click',  stepBack);
  btnExit.addEventListener('click',  () => {
    setMode('play');
    renderPuzzle(state, puzzleEl);
    updatePuzzle(state, 0);
    setControlState(state);
    setEnabled(true);
  });

  updateMoveHighlight();
}

function updateMoveHighlight() {
  if (!solverMoveListEl) return;
  solverMoveListEl.querySelectorAll('li').forEach((li, idx) => {
    li.classList.toggle('solver-step-active', idx === solveStep);
    li.classList.toggle('solver-step-done',   idx < solveStep);
  });
  const active = solverMoveListEl.querySelector('.solver-step-active');
  if (active) active.scrollIntoView({ block: 'nearest' });
}

function stepForward() {
  if (solveStep >= solveMoves.length) return;
  const { barIdx, dir } = solveMoves[solveStep];
  applyMove(solveState, barIdx, dir);
  updatePuzzle(solveState, barIdx);
  solveStep++;
  updateMoveHighlight();
  setStatus(`Step ${solveStep} / ${solveMoves.length}`);
}

function stepBack() {
  if (solveStep <= 0) return;
  solveStep--;
  const { barIdx, dir } = solveMoves[solveStep];
  applyMove(solveState, barIdx, -dir);
  updatePuzzle(solveState, -1);
  updateMoveHighlight();
  setStatus(`Step ${solveStep} / ${solveMoves.length}`);
}

function startPlayback() {
  if (solveTimer) return;
  if (solveStep >= solveMoves.length) {
    solveStep = 0;
    solveState = cloneState(state);
    updatePuzzle(solveState, -1);
    updateMoveHighlight();
  }
  solveTimer = setInterval(() => {
    if (solveStep >= solveMoves.length) { stopPlayback(); return; }
    stepForward();
  }, 600);
}

function stopPlayback() {
  clearInterval(solveTimer);
  solveTimer = null;
}

// ── button wiring ──────────────────────────────────────────────────────────

// onBtn is null-safe: player.html only includes a subset of Stage 1 buttons.
function onBtn(id, fn) { document.getElementById(id)?.addEventListener('click', fn); }

onBtn('btn-reset', () => {
  if (!state || mode !== 'play') return;
  resetPuzzle(state);
  updatePuzzle(state, getSelectedBar());
  setStatus('');
  setEnabled(true);
});

onBtn('btn-new', () => {
  setMode('edit');
  const { handleMove, handleSelect } = enterEditMode(puzzleEl, editorPanel, {
    onSave: (bars) => {
      loadState(bars);
      setMode('play');
      setStatus('Custom puzzle loaded.');
    },
    onCancel: () => setMode('play'),
  });
  setCallbacks(handleMove, handleSelect);
  setEnabled(true);   // W/S/A/D active in edit mode
  setStatus('Edit mode: W/S select bar · A/D shift position · toggle ◀▶ arrows to set connections');
});

onBtn('btn-load', () => { ioPanel.hidden = !ioPanel.hidden; });

onBtn('btn-export', () => { if (state) exportPuzzle(state); });

onBtn('btn-solve', () => {
  if (!state) return;
  setStatus('Solving…');
  const moves = solve(state);
  if (!moves) { setStatus('No solution found.'); return; }
  solveMoves  = moves;
  solveStep   = 0;
  solveState  = cloneState(state);
  setMode('solving');
  buildSolverPanel();
  setStatus(`Solution: ${moves.length} move${moves.length !== 1 ? 's' : ''}.`);
});

onBtn('btn-sample', loadFromSample);

// ── bootstrap ──────────────────────────────────────────────────────────────

installControls({ onMove: handlePlayMove, onSelect: handlePlaySelect });
initIO(ioPanel, { getState: () => state, onLoad: loadState });
setMode('play');

// Server-embedded puzzle (Flask player route) takes priority over sample.
const puzzleDataEl = document.getElementById('puzzle-data');
if (puzzleDataEl) {
  try {
    loadState(JSON.parse(puzzleDataEl.textContent));
  } catch (e) {
    setStatus(`Failed to load puzzle: ${e.message}`);
  }
} else {
  loadFromSample();
}

async function loadFromSample() {
  try {
    const resp = await fetch('./samples/example.json');
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    loadState(await resp.json());
    setStatus('Sample puzzle loaded.');
  } catch (err) {
    setStatus(`Could not load sample: ${err.message}`);
  }
}

// ── tiny helpers ───────────────────────────────────────────────────────────

function el(tag) { return document.createElement(tag); }
function mkbtn(text) { const b = el('button'); b.type = 'button'; b.textContent = text; return b; }
function mkbar(...btns) {
  const d = el('div'); d.className = 'solver-controls';
  btns.forEach(b => d.appendChild(b)); return d;
}
