// js/render.js — DOM rendering + CSS-transition animation.

let _barEls = [];

/**
 * Build bar DOM nodes from scratch. Call once per puzzle load.
 * Bars are appended in index order; CSS flex-direction: column-reverse
 * makes bar 0 appear at the bottom visually.
 */
export function renderPuzzle(state, container) {
  container.innerHTML = '';
  _barEls = [];

  for (let i = 0; i < state.bars.length; i++) {
    const bar = document.createElement('div');
    bar.className = 'bar';
    bar.dataset.barIndex = i;

    const holes = document.createElement('span');
    holes.className = 'holes';
    holes.textContent = '○○○○○○○';
    bar.appendChild(holes);

    // Pin: absolutely positioned inside bar, counter-translates so it
    // stays at the same world column regardless of bar position.
    // left = .35rem (left padding) + 3ch (hole-3 offset) + pos * 1ch (counter)
    // Net: pin world-x is constant while bar slides.
    const pin = document.createElement('span');
    pin.className = 'pin';
    pin.textContent = '●';
    bar.appendChild(pin);

    bar.style.setProperty('--pos', state.bars[i].position);
    container.appendChild(bar);
    _barEls.push(bar);
  }
}

/**
 * Sync CSS vars + classes after a state change. No DOM rebuild.
 * CSS transition on `transform` gives the animation automatically.
 */
export function updatePuzzle(state, selectedBar = -1) {
  state.bars.forEach((bar, i) => {
    _barEls[i].style.setProperty('--pos', bar.position);
    _barEls[i].classList.toggle('selected', i === selectedBar);
    _barEls[i].classList.remove('invalid');
  });
}

/** Flash the invalid-move bar red for one transition cycle. */
export function flashInvalid(barIdx) {
  const el = _barEls[barIdx];
  if (!el) return;
  el.classList.add('invalid');
  setTimeout(() => el.classList.remove('invalid'), 250);
}
