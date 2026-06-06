// js/solver.js — BFS optimal solver.
// TODO: If 8-bar puzzles prove slow on main thread, hoist into a Worker.

import { canApplyMove, applyMove, isSolved, cloneState, positionsKey } from './state.js';

const DIRS = [+1, -1];

/**
 * Find the shortest sequence of moves that solves the puzzle.
 * @param {object} state  Puzzle state (not mutated).
 * @returns {{ barIdx: number, dir: number }[] | null}
 *   Ordered move list, or null if no solution exists.
 */
export function solve(state) {
  const startKey = positionsKey(state);

  if (isSolved(state)) return [];

  // Each visited entry stores the parent key + the move that reached this node.
  const visited = new Map();  // key → { parentKey, move }
  visited.set(startKey, { parentKey: null, move: null });

  // Queue entries: { state (clone), key }
  const queue = [{ state: cloneState(state), key: startKey }];
  const n = state.bars.length;
  const goalKey = Array(n).fill(0).join(',');

  let head = 0;
  while (head < queue.length) {
    const { state: cur, key: curKey } = queue[head++];

    for (let barIdx = 0; barIdx < n; barIdx++) {
      for (const dir of DIRS) {
        if (!canApplyMove(cur, barIdx, dir)) continue;

        const next = cloneState(cur);
        applyMove(next, barIdx, dir);
        const nextKey = positionsKey(next);

        if (visited.has(nextKey)) continue;

        const move = { barIdx, dir };
        visited.set(nextKey, { parentKey: curKey, move });

        if (nextKey === goalKey) return reconstructPath(visited, nextKey);

        queue.push({ state: next, key: nextKey });
      }
    }
  }

  return null;   // unsolvable
}

function reconstructPath(visited, goalKey) {
  const moves = [];
  let key = goalKey;
  while (visited.get(key).move !== null) {
    const { parentKey, move } = visited.get(key);
    moves.push(move);
    key = parentKey;
  }
  return moves.reverse();
}
