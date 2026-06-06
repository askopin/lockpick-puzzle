// js/controls.js — keyboard W/S/A/D input + bar selection.
// app.js owns mode gating; this module just fires callbacks when enabled.

let _state = null;
let _selectedBar = 0;
let _enabled = true;
let _onMove = null;
let _onSelect = null;

/**
 * Attach keyboard listener. Call once at startup.
 * @param {{ onMove: (barIdx: number, dir: number) => void,
 *           onSelect: (barIdx: number) => void }} callbacks
 */
export function installControls({ onMove, onSelect }) {
  _onMove = onMove;
  _onSelect = onSelect;
  document.addEventListener('keydown', _handleKey);
}

/** Swap move/select callbacks — used when switching between play and edit modes. */
export function setCallbacks(onMove, onSelect) {
  _onMove = onMove;
  _onSelect = onSelect;
}

/** Update the state reference whenever a new puzzle loads. */
export function setControlState(state) {
  _state = state;
  _selectedBar = 0;
}

/** Enable or disable keyboard input (disabled during solving mode). */
export function setEnabled(enabled) {
  _enabled = enabled;
}

export function getSelectedBar() {
  return _selectedBar;
}

function _handleKey(e) {
  if (!_enabled || !_state) return;
  // Don't hijack text-entry elements; buttons are fine (W/S/A/D are not button keys).
  if (e.target.closest('input, select, textarea')) return;

  const key = e.key.toUpperCase();
  const n = _state.bars.length;

  switch (key) {
    case 'W':
      e.preventDefault();
      _selectedBar = Math.min(_selectedBar + 1, n - 1);
      _onSelect?.(_selectedBar);
      break;
    case 'S':
      e.preventDefault();
      _selectedBar = Math.max(_selectedBar - 1, 0);
      _onSelect?.(_selectedBar);
      break;
    case 'A':
      e.preventDefault();
      _onMove?.(_selectedBar, +1);  // left: dir = +1
      break;
    case 'D':
      e.preventDefault();
      _onMove?.(_selectedBar, -1);  // right: dir = -1
      break;
  }
}
