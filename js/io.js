// js/io.js — JSON import / export.

import { toJSON } from './state.js';

/**
 * Populate the io panel and wire its controls.
 * @param {HTMLElement} container  #io-panel
 * @param {{ getState: () => object, onLoad: (json: object) => void }} opts
 *   onLoad receives the parsed JSON object; caller (app.js) runs loadPuzzle.
 */
export function initIO(container, { getState, onLoad }) {
  container.innerHTML = '';

  const errorEl = el('p', { className: 'io-error', hidden: true });

  // ── import area ──────────────────────────────────────────────────────────

  const textarea = el('textarea', {
    className: 'io-textarea',
    rows: 8,
    spellcheck: false,
    placeholder: 'Paste puzzle JSON here…',
  });

  const fileInput = el('input', { type: 'file', accept: '.json,application/json' });
  const btnImportText = btn('Import pasted JSON');
  const btnClose = btn('Close');

  append(container,
    heading('Import'),
    label('Paste JSON:', textarea),
    btnImportText,
    label('Or load from file:', fileInput),
    errorEl,
    el('hr'),
    heading('Export'),
    btn_copy(getState),
    el('hr'),
    btnClose,
  );

  // ── handlers ─────────────────────────────────────────────────────────────

  function showError(msg) { errorEl.textContent = msg; errorEl.hidden = false; }
  function clearError()   { errorEl.hidden = true; }

  function importText(text) {
    clearError();
    let json;
    try {
      json = JSON.parse(text.trim());
    } catch (e) {
      showError(`Invalid JSON — ${e.message}`);
      return;
    }
    try {
      onLoad(json);
      container.hidden = true;
    } catch (e) {
      showError(e.message);
    }
  }

  btnImportText.addEventListener('click', () => importText(textarea.value));

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => importText(e.target.result);
    reader.readAsText(file);
  });

  btnClose.addEventListener('click', () => { container.hidden = true; });
}

/** Trigger a puzzle.json download of current state. */
export function exportPuzzle(state) {
  const text = JSON.stringify(toJSON(state), null, 2);
  const blob = new Blob([text], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'puzzle.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── tiny DOM helpers (private) ─────────────────────────────────────────────

function el(tag, props = {}) {
  const e = document.createElement(tag);
  Object.assign(e, props);
  return e;
}

function btn(text) {
  return el('button', { type: 'button', textContent: text });
}

function heading(text) {
  return el('strong', { textContent: text });
}

function label(text, child) {
  const l = document.createElement('label');
  l.append(text + ' ', child);
  return l;
}

function append(parent, ...children) {
  children.forEach(c => { parent.appendChild(c); parent.appendChild(el('br')); });
}

function btn_copy(getState) {
  const b = btn('Copy JSON to clipboard');
  b.addEventListener('click', async () => {
    try {
      const text = JSON.stringify(toJSON(getState()), null, 2);
      await navigator.clipboard.writeText(text);
      b.textContent = 'Copied!';
      setTimeout(() => { b.textContent = 'Copy JSON to clipboard'; }, 1500);
    } catch {
      b.textContent = 'Copy failed (check permissions)';
    }
  });
  return b;
}
