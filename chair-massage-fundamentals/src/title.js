// TITLE: the fake CEU landing page (markup in index.html, styles in ui.css). Keyboard and mouse
// only: on a touch-only device the Begin button goes away and the phone card shows the byline
// and the real chair's address instead. Touch play is v2.
import { VERSION } from './version.js';
export function touchOnly() {
  const mq = (q) => !!(window.matchMedia && window.matchMedia(q).matches);
  return mq('(pointer: coarse)') && !mq('(any-pointer: fine)');
}

export function initTitle() {
  const phone = touchOnly();
  document.body.classList.toggle('touch-only', phone);
  const card = document.getElementById('mobile-note');
  if (card) card.hidden = !phone;
  const build = document.getElementById('build');   // footer, after the byline
  if (build) build.textContent = `build ${VERSION}`;
  // Reset the save: runs, unlocks, and the first-pivot flag go back to a fresh course.
  const reset = document.getElementById('reset-progress');
  if (reset) reset.addEventListener('click', () => {
    if (!window.confirm('Reset all progress? Runs, unlocks and the first-time course come back fresh.')) return;
    try { window.localStorage.removeItem('cmf.meta.v1'); } catch (_) { /* private mode */ }
    window.location.reload();
  });
  return phone;
}
