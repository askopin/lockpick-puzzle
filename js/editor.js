// js/editor.js — visual puzzle editor.
// Renders into #puzzle (same element as play mode) with toggle-arrow overlays.
// W/S/A/D handled by controls.js; app.js swaps callbacks on mode enter/exit.

import { setControlState } from './controls.js';

const POS_MIN = -3;
const POS_MAX = 3;

/**
 * Enter edit mode. Renders a fresh draft into puzzleEl; populates toolbarEl.
 * Returns { handleMove, handleSelect } for app.js to swap into controls.
 *
 * @param {HTMLElement} puzzleEl   #puzzle — shared with play mode
 * @param {HTMLElement} toolbarEl  #editor-panel — compact save/cancel toolbar
 * @param {{ onSave, onCancel }} opts
 */
export function enterEditMode(puzzleEl, toolbarEl, { onSave, onCancel, initialBars = null, saveLabel = 'Save & play' }) {
  let draft = initialBars ? makeDraftFromBars(initialBars) : makeDraft(3);
  let selectedBar = 0;
  let barEls = [];      // .bar divs, indexed same as draft.bars
  let wrapEls = [];     // .editor-bar-wrap divs

  // ── draft helpers ───────────────────────────────────────────────────────

  function makeDraft(n) {
    const bars = [];
    for (let i = 0; i < n; i++) {
      const connections = Array(n).fill(0);
      connections[i] = 1;
      bars.push({ position: 0, connections });
    }
    return { bars };
  }

  function makeDraftFromBars(bars) {
    return {
      bars: bars.map(b => ({ position: b.position, connections: [...b.connections] })),
    };
  }

  function addBar() {
    const n = draft.bars.length;
    if (n >= 8) return;
    draft.bars.forEach(b => b.connections.push(0));
    const connections = Array(n + 1).fill(0);
    connections[n] = 1;
    draft.bars.push({ position: 0, connections });
    selectedBar = n;
    syncControls();
    renderAll();
    buildToolbar();
  }

  function removeBar(idx) {
    if (draft.bars.length <= 3) return;
    draft.bars.splice(idx, 1);
    draft.bars.forEach(b => b.connections.splice(idx, 1));
    selectedBar = Math.min(selectedBar, draft.bars.length - 1);
    syncControls();
    renderAll();
    buildToolbar();
  }

  function syncControls() {
    // Give controls.js the new bar count; resets its selectedBar to 0,
    // so we re-apply ours afterward.
    setControlState({ bars: draft.bars });
  }

  // ── callbacks for controls.js ───────────────────────────────────────────

  function handleMove(barIdx, dir) {
    const next = draft.bars[barIdx].position + dir;
    if (next < POS_MIN || next > POS_MAX) {
      flashBar(barIdx);
      return;
    }
    draft.bars[barIdx].position = next;
    // Animate bar via CSS var — no full re-render needed.
    if (barEls[barIdx]) barEls[barIdx].style.setProperty('--pos', next);
  }

  function handleSelect(barIdx) {
    selectedBar = barIdx;
    updateSelection();
    updateArrows();
  }

  // ── DOM build ───────────────────────────────────────────────────────────

  function renderAll() {
    puzzleEl.innerHTML = '';
    barEls = [];
    wrapEls = [];

    for (let i = 0; i < draft.bars.length; i++) {
      const { position, connections } = draft.bars[i];
      const isSel = i === selectedBar;
      const connVal = draft.bars[selectedBar].connections[i]; // ignored for self (isSel)

      const wrap = document.createElement('div');
      wrap.className = 'editor-bar-wrap';

      // ◀ toggle
      const arrowL = makeArrow('◀', 'l');
      arrowL.hidden = isSel;
      if (!isSel && connVal === -1) arrowL.classList.add('active');
      arrowL.addEventListener('click', () => toggleConn(i, -1));

      // Bar (identical DOM structure to render.js)
      const barEl = document.createElement('div');
      barEl.className = 'bar' + (isSel ? ' selected' : '');
      barEl.style.setProperty('--pos', position);
      const holesEl = document.createElement('span');
      holesEl.className = 'holes';
      holesEl.textContent = '○○○○○○○';
      const pinEl = document.createElement('span');
      pinEl.className = 'pin';
      pinEl.textContent = '●';
      barEl.append(holesEl, pinEl);

      // ▶ toggle
      const arrowR = makeArrow('▶', 'r');
      arrowR.hidden = isSel;
      if (!isSel && connVal === +1) arrowR.classList.add('active');
      arrowR.addEventListener('click', () => toggleConn(i, +1));

      wrap.append(arrowL, barEl, arrowR);
      puzzleEl.appendChild(wrap);
      barEls.push(barEl);
      wrapEls.push(wrap);
    }
  }

  // ── incremental updates (no full re-render) ─────────────────────────────

  function updateSelection() {
    barEls.forEach((el, i) => el.classList.toggle('selected', i === selectedBar));
  }

  function updateArrows() {
    wrapEls.forEach((wrap, i) => {
      const isSel = i === selectedBar;
      const arrowL = wrap.querySelector('.editor-arrow-l');
      const arrowR = wrap.querySelector('.editor-arrow-r');
      if (!arrowL || !arrowR) return;
      arrowL.hidden = isSel;
      arrowR.hidden = isSel;
      if (!isSel) {
        const v = draft.bars[selectedBar].connections[i];
        arrowL.classList.toggle('active', v === -1);
        arrowR.classList.toggle('active', v === +1);
      }
    });
  }

  function toggleConn(barIdx, dir) {
    const cur = draft.bars[selectedBar].connections[barIdx];
    // Toggle: same dir = off (0); opposite or 0 = on
    draft.bars[selectedBar].connections[barIdx] = (cur === dir) ? 0 : dir;
    updateArrows();
  }

  function flashBar(barIdx) {
    const el = barEls[barIdx];
    if (!el) return;
    el.classList.add('invalid');
    setTimeout(() => el.classList.remove('invalid'), 250);
  }

  function makeArrow(glyph, side) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = glyph;
    b.className = `editor-arrow editor-arrow-${side}`;
    return b;
  }

  // ── toolbar ─────────────────────────────────────────────────────────────

  function buildToolbar() {
    toolbarEl.innerHTML = '';
    const n = draft.bars.length;
    const errEl = document.createElement('span');
    errEl.className = 'editor-error';
    errEl.hidden = true;

    const btnAdd    = mkbtn(`+ Add bar`);
    const btnRemove = mkbtn(`- Remove bar`);
    const btnSave   = mkbtn(saveLabel);
    const btnCancel = mkbtn('Cancel');
    btnAdd.disabled    = n >= 8;
    btnRemove.disabled = n <= 3;

    btnAdd.addEventListener('click', addBar);
    btnRemove.addEventListener('click', () => removeBar(selectedBar));
    btnSave.addEventListener('click', () => {
      errEl.hidden = true;
      try { onSave(draft.bars); }
      catch (e) { errEl.textContent = e.message; errEl.hidden = false; }
    });
    btnCancel.addEventListener('click', onCancel);

    toolbarEl.append(btnAdd, ' ', btnRemove, ' ', btnSave, ' ', btnCancel, ' ', errEl);
  }

  // ── init ────────────────────────────────────────────────────────────────

  syncControls();
  renderAll();
  buildToolbar();

  return { handleMove, handleSelect };
}

function mkbtn(text) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = text;
  return b;
}
