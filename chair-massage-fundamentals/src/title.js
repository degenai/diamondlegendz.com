// TITLE: the fake CEU landing page (markup in index.html, styles in ui.css). Keyboard and mouse
// only: on a touch-only device the Begin button goes away and the phone card shows the byline
// and the real chair's address instead. Touch play is v2.
export function touchOnly() {
  const mq = (q) => !!(window.matchMedia && window.matchMedia(q).matches);
  return mq('(pointer: coarse)') && !mq('(any-pointer: fine)');
}

export function initTitle() {
  const phone = touchOnly();
  document.body.classList.toggle('touch-only', phone);
  const card = document.getElementById('mobile-note');
  if (card) card.hidden = !phone;
  return phone;
}
