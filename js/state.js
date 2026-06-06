// js/state.js — puzzle data model + move semantics.
//
// Schema (spec form, canonical):
//   [ { position: int in [-3, 3], connections: int[N] in {-1, 0, 1} }, ... ]
//
// We also accept the legacy { bars: [...] } wrapper on input for
// forward-compatibility, but always export the spec shape.
//
// Move math (PLAN.md / CLAUDE.md):
//   shifting bar i by dir d ∈ {-1, +1} sets
//     position[j] += connections[i][j] * d   for every j
//   d = +1 is LEFT (per spec: "shifted to the left, offset increased by 1").

export const POSITION_MIN = -3;
export const POSITION_MAX = 3;
export const HOLES_PER_BAR = 7;
export const BARS_MIN = 3;
export const BARS_MAX = 8;

class PuzzleError extends Error {}

function normalizeInput(json) {
  if (Array.isArray(json)) return json;
  if (json && Array.isArray(json.bars)) return json.bars;
  throw new PuzzleError('Puzzle must be an array of bars or { bars: [...] }');
}

function validateBars(bars) {
  if (!Array.isArray(bars)) {
    throw new PuzzleError('Bars must be an array');
  }
  const n = bars.length;
  if (n < BARS_MIN || n > BARS_MAX) {
    throw new PuzzleError(`Bar count ${n} out of range [${BARS_MIN}, ${BARS_MAX}]`);
  }
  bars.forEach((bar, i) => {
    if (!bar || typeof bar !== 'object') {
      throw new PuzzleError(`Bar ${i}: must be an object`);
    }
    const { position, connections } = bar;
    if (!Number.isInteger(position) || position < POSITION_MIN || position > POSITION_MAX) {
      throw new PuzzleError(`Bar ${i}: position must be integer in [${POSITION_MIN}, ${POSITION_MAX}], got ${position}`);
    }
    if (!Array.isArray(connections) || connections.length !== n) {
      throw new PuzzleError(`Bar ${i}: connections must be an array of length ${n}, got ${connections && connections.length}`);
    }
    connections.forEach((v, j) => {
      if (!Number.isInteger(v) || v < -1 || v > 1) {
        throw new PuzzleError(`Bar ${i}: connections[${j}] must be -1, 0, or 1, got ${v}`);
      }
    });
    if (connections[i] !== 1) {
      throw new PuzzleError(`Bar ${i}: connections[${i}] (self) must be 1, got ${connections[i]}`);
    }
  });
}

export function loadPuzzle(json) {
  const raw = normalizeInput(json);
  validateBars(raw);
  const bars = raw.map((b) => ({
    position: b.position,
    connections: b.connections.slice(),
  }));
  const initial = bars.map((b) => b.position);
  return { bars, initial };
}

export function isInBounds(p) {
  return p >= POSITION_MIN && p <= POSITION_MAX;
}

export function canApplyMove(state, barIdx, dir) {
  if (dir !== 1 && dir !== -1) return false;
  const { bars } = state;
  if (barIdx < 0 || barIdx >= bars.length) return false;
  const row = bars[barIdx].connections;
  for (let j = 0; j < bars.length; j++) {
    const next = bars[j].position + row[j] * dir;
    if (!isInBounds(next)) return false;
  }
  return true;
}

export function applyMove(state, barIdx, dir) {
  if (!canApplyMove(state, barIdx, dir)) {
    throw new PuzzleError(`Invalid move: bar ${barIdx} dir ${dir}`);
  }
  const { bars } = state;
  const row = bars[barIdx].connections;
  for (let j = 0; j < bars.length; j++) {
    bars[j].position += row[j] * dir;
  }
  return state;
}

export function resetPuzzle(state) {
  state.bars.forEach((b, i) => { b.position = state.initial[i]; });
  return state;
}

export function isSolved(state) {
  return state.bars.every((b) => b.position === 0);
}

export function cloneState(state) {
  return {
    bars: state.bars.map((b) => ({
      position: b.position,
      connections: b.connections,  // immutable per puzzle, share ref
    })),
    initial: state.initial.slice(),
  };
}

export function positionsKey(state) {
  return state.bars.map((b) => b.position).join(',');
}

/** Returns indices of bars that would exceed [-3, 3] for a given move. */
export function findViolatingBars(state, barIdx, dir) {
  const { bars } = state;
  const row = bars[barIdx].connections;
  const violated = [];
  for (let j = 0; j < bars.length; j++) {
    if (!isInBounds(bars[j].position + row[j] * dir)) violated.push(j);
  }
  return violated;
}

export function toJSON(state) {
  return state.bars.map((b, i) => ({
    position: state.initial[i],
    connections: b.connections.slice(),
  }));
}

export { PuzzleError };
