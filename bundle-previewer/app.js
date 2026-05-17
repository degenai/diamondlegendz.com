// BBL Bundle Previewer — renders a bundle JSON into the page, with anime.js v4
// entrance animations. CSP-safe (no eval, no inline event handlers, no external
// scripts beyond facets/vendor/anime.esm.min.js). Internal dev tool for now;
// later may get a slimmed-down buyer-facing variant that drops the heatmap and
// raw JSON load controls.

import { animate, stagger } from '../facets/vendor/anime.esm.min.js';

// ── Bundle loading ─────────────────────────────────────────────────────────

// Pick the bundle to load: prefer `?lair=<slug>` from the URL (hub-page link),
// fall back to the page's inline default-bundle-path script tag. Slug is
// constrained to [a-z0-9-] to keep the path build safe from injection.
function resolveBundlePath() {
  const params = new URLSearchParams(window.location.search);
  const lair = params.get('lair');
  if (lair && /^[a-z0-9-]+$/.test(lair)) {
    return `sample-bundles/${lair}.json`;
  }
  const fallbackTag = document.getElementById('default-bundle-path');
  if (fallbackTag) {
    try {
      return JSON.parse(fallbackTag.textContent);
    } catch (_) { /* fall through */ }
  }
  return 'sample-bundles/tithe.json';
}

const defaultPath = resolveBundlePath();

async function loadDefaultBundle() {
  try {
    const resp = await fetch(defaultPath);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.json();
  } catch (e) {
    // Likely running via file:// — fetch is blocked by browsers for local files.
    // Surface a friendly message instructing user to use the file picker.
    showError(
      `Couldn't auto-load bundle "${defaultPath}" (${e.message}). ` +
      `If you opened this page directly from disk, browsers block file:// fetches. ` +
      `Use the "Load a bundle JSON" picker above, or serve the directory with ` +
      `\`python -m http.server\` and reload.`
    );
    return null;
  }
}

function showError(msg) {
  const slot = document.getElementById('error-slot');
  slot.innerHTML = `<div class="error">${escapeHtml(msg)}</div>`;
}

// File-picker fallback was removed when the lair viewer became a per-lair
// page (the hub's dev tools handle one-off bundle JSON loading and route
// here via ?source=dev + sessionStorage).
const filePickerEl = document.getElementById('bundle-file');
if (filePickerEl) {
  filePickerEl.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const bundle = JSON.parse(text);
      document.getElementById('error-slot').innerHTML = '';
      render(bundle);
    } catch (err) {
      showError(`Couldn't parse JSON: ${err.message}`);
    }
  });
}

// ── Rendering ──────────────────────────────────────────────────────────────

function render(bundle) {
  if (!bundle || !bundle.title) {
    showError('Bundle JSON is missing required fields (need at least `title` and `cards`).');
    return;
  }

  renderCatalogLine(bundle.series_label, bundle.catalog_id);
  renderHubBadges(bundle.hubs || []);
  renderTitle(bundle.title);
  document.getElementById('subtitle').textContent = bundle.subtitle || '';
  document.getElementById('narrative').textContent = bundle.narrative || '';
  renderAnchorTags(bundle.anchor_tags || []);
  renderArtCarousel(bundle.cards || []);
  renderMichiPage(bundle);  // async, fires fetch + populates as inserts manifest loads
  renderCardGrid(bundle.cards || []);
  renderCohesion(bundle.cohesion || {});
  renderPricing(bundle.pricing || null);
  renderCheckout(bundle.checkout || null, bundle.pricing || null, bundle.title || '');
  renderMetadata(bundle.metadata || {}, (bundle.cards || []).length);

  // Entrance animations after DOM is populated.
  animateEntrance();
}

function renderCatalogLine(seriesLabel, catalogId) {
  const el = document.getElementById('catalog-line');
  if (!seriesLabel && !catalogId) {
    el.style.display = 'none';
    return;
  }
  el.style.display = '';
  const parts = [];
  if (seriesLabel) parts.push(`<span class="series-label">${escapeHtml(seriesLabel)}</span>`);
  if (catalogId) parts.push(`<span class="catalog-id">${escapeHtml(catalogId)}</span>`);
  el.innerHTML = parts.join(' &middot; ');
}

function renderHubBadges(hubs) {
  const container = document.getElementById('hub-badges');
  container.innerHTML = '';
  hubs.forEach(h => {
    const el = document.createElement('span');
    el.className = 'hub-badge';
    el.textContent = h;
    container.appendChild(el);
  });
}

function renderTitle(title) {
  const el = document.getElementById('title');
  // Splittext: wrap each char in a span so stagger can animate them individually.
  el.innerHTML = '';
  for (const ch of title) {
    const span = document.createElement('span');
    span.className = 'char';
    span.textContent = ch === ' ' ? ' ' : ch;
    el.appendChild(span);
  }
}

function renderAnchorTags(tags) {
  const container = document.getElementById('anchor-tags');
  container.innerHTML = '';
  tags.forEach(t => {
    const el = document.createElement('span');
    el.className = 'anchor-tag';
    el.textContent = t;
    container.appendChild(el);
  });
}

// ── Art carousel ───────────────────────────────────────────────────────────
//
// Layers, in order of priority (later overrides earlier):
//   1. Auto-marquee: a manual rAF loop scrolling track left at MARQUEE_SPEED px/s.
//   2. Hover-pause: mouse over carousel halts the marquee for reading.
//   3. Drag: pointerdown + move > DRAG_THRESHOLD_PX takes manual control of
//      translateX. Resumes auto-marquee on release UNLESS hover-paused.
//   4. Click / tap (no drag): opens the lightbox with the full-size art_crop.
//      Single gesture, same on PC and mobile. The drag-threshold is what
//      distinguishes "click on a slide" from "start dragging the carousel."
//
// We replaced the anime.js-driven marquee with a manual rAF loop because anime.js
// timelines don't compose well with the interrupting drag gesture: pausing mid-
// loop and snapping the transform via direct style writes loses anime.js's
// internal position, and resuming would jump. Manual rAF gives us a single
// authoritative `currentTranslateX` that drag and marquee both write/read.
// anime.js v4 is still used for the entrance animations elsewhere in this file
// — that surface is unchanged.

const MARQUEE_SPEED_PX_S = 60;
const DRAG_THRESHOLD_PX = 4;

let currentCarouselCards = [];  // source data, indexed by slide.dataset.sourceIdx
let currentTranslateX = 0;
let halfTrackWidth = 0;
let isMarqueeRunning = false;
let isHoverPaused = false;
let marqueeRafId = null;
let lastMarqueeFrameTime = 0;

let dragState = null;
let activeLightbox = null;

// ── Michi binder pages ─────────────────────────────────────────────────────
// Sketchbook spec at BBL/docs/sketchbook.md "Michi Method Binders for Discrete
// Lairs". Multi-page composition: each page is a 3x3 grid mixing card slots
// (full TCG card images via image_url) with fan-art inserts (1x1 single-slot
// portraits or 1x2 horizontal extended panels) sourced from the bundle's
// michi-inserts/ directory. No labels — only cards and art.
//
// Per-bundle insert manifests live at `michi-inserts/<slug>/_manifest.json`;
// the renderer falls back to a quiet skip if the manifest is missing.

const MICHI_PAGE_CARD_SLOTS = 5;
const MICHI_PAGE_TOTAL_SLOTS = 9;

async function renderMichiPage(bundle) {
  const host = document.getElementById('michi-pages');
  if (!host) return;
  host.replaceChildren();

  const cards = (bundle.cards || []).filter(c => c.image_url);
  if (!cards.length) return;

  const inserts = await loadMichiInserts(bundle.slug);

  // Distribute cards across pages: ~5 cards per page, all unique cards shown.
  const pages = [];
  for (let i = 0; i < cards.length; i += MICHI_PAGE_CARD_SLOTS) {
    pages.push(cards.slice(i, i + MICHI_PAGE_CARD_SLOTS));
  }

  // Insert cycle position — every page draws fresh art from the pool so no
  // page repeats the same insert as a sibling page.
  let insertCursor = 0;
  const nextInsert = (wantWide) => {
    if (!inserts.length) return null;
    // Try to find an insert matching the requested aspect; if none, take any.
    for (let tries = 0; tries < inserts.length; tries++) {
      const candidate = inserts[insertCursor % inserts.length];
      insertCursor++;
      const isWide = Array.isArray(candidate.panel_dimensions_slots) &&
                     candidate.panel_dimensions_slots[0] === 2;
      if (wantWide === null || wantWide === isWide) return candidate;
    }
    return inserts[(insertCursor++) % inserts.length];
  };

  for (const pageCards of pages) {
    const pageEl = document.createElement('div');
    pageEl.className = 'michi-page';

    // Build a 9-slot layout. Strategy: place cards first, then fill the
    // remaining slots with inserts. Try to slot one wide (1x2) insert per
    // page when room allows; the rest are 1x1.
    const slotsRemaining = MICHI_PAGE_TOTAL_SLOTS - pageCards.length;
    let wideSlotsAllowed = slotsRemaining >= 2 ? 1 : 0;
    const items = [];
    for (const card of pageCards) {
      items.push({ kind: 'card', card });
    }
    let remaining = slotsRemaining;
    while (remaining > 0) {
      const wantWide = wideSlotsAllowed > 0 && remaining >= 2;
      const insert = nextInsert(wantWide ? true : false) || nextInsert(null);
      if (!insert) break;
      const isWide = Array.isArray(insert.panel_dimensions_slots) &&
                     insert.panel_dimensions_slots[0] === 2 &&
                     remaining >= 2;
      items.push({ kind: 'art', insert, wide: isWide });
      remaining -= isWide ? 2 : 1;
      if (isWide) wideSlotsAllowed--;
    }

    // Lightly shuffle deterministically so each page reads differently
    // without the layout jumping between renders.
    shuffleWithSeed(items, pages.indexOf(pageCards) * 7919 + 31);

    for (const item of items) {
      const el = document.createElement('div');
      el.className = 'michi-slot';
      if (item.kind === 'card') {
        const img = document.createElement('img');
        img.src = item.card.image_url;
        img.alt = item.card.name || '';
        img.loading = 'lazy';
        el.appendChild(img);
      } else if (item.kind === 'art') {
        if (item.wide) el.classList.add('art-wide');
        const img = document.createElement('img');
        img.src = `michi-inserts/${bundle.slug}/${item.insert.image_file}`;
        img.alt = item.insert.theme_fit || item.insert.creator_handle || '';
        img.loading = 'lazy';
        el.appendChild(img);
      }
      pageEl.appendChild(el);
    }
    host.appendChild(pageEl);
  }
}

async function loadMichiInserts(slug) {
  if (!slug) return [];
  try {
    const resp = await fetch(`michi-inserts/${slug}/_manifest.json`);
    if (!resp.ok) return [];
    const data = await resp.json();
    return Array.isArray(data) ? data : (data.inserts || []);
  } catch (_) {
    return [];
  }
}

function shuffleWithSeed(arr, seed) {
  // Tiny deterministic shuffle so each page renders the same way every time
  // but pages differ from each other.
  let s = seed >>> 0;
  for (let i = arr.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function renderArtCarousel(cards) {
  const section = document.getElementById('art-carousel-section');
  const track = document.getElementById('art-carousel-track');
  const carousel = track ? track.parentElement : null;
  if (!track || !carousel) return;

  stopMarquee();
  closeLightbox();
  dragState = null;
  carousel.classList.remove('is-dragging');
  currentTranslateX = 0;
  track.style.transform = '';
  track.innerHTML = '';

  // Only include cards that have an art_crop_url. MTG cards have these via
  // Scryfall; Pokémon cards do not yet (no equivalent API endpoint).
  const slidesData = cards.filter(c => c.art_crop_url);
  if (!slidesData.length) {
    section.style.display = 'none';
    currentCarouselCards = [];
    return;
  }
  section.style.display = '';
  currentCarouselCards = slidesData.slice();

  // Duplicate the slide list so the marquee loops seamlessly: we wrap by
  // adding +halfTrackWidth whenever currentTranslateX drops below -halfTrackWidth.
  // The clones' dataset.idx points at the same source-card index modulo length.
  const sequence = [...slidesData, ...slidesData];
  sequence.forEach((card, idx) => {
    const slide = document.createElement('div');
    slide.className = 'art-carousel-slide';
    slide.dataset.idx = idx;
    slide.dataset.sourceIdx = String(idx % slidesData.length);
    slide.tabIndex = 0;

    const img = document.createElement('img');
    img.src = card.art_crop_url;
    img.alt = card.name || '';
    img.loading = 'lazy';
    img.draggable = false;
    img.onerror = () => { slide.style.background = '#400'; };
    slide.appendChild(img);

    const caption = document.createElement('div');
    caption.className = 'slide-caption';
    const nm = document.createElement('span');
    nm.className = 'slide-name';
    nm.textContent = card.name || '';
    caption.appendChild(nm);
    if (card.artist) {
      const art = document.createElement('span');
      art.className = 'slide-artist';
      art.textContent = card.artist;
      caption.appendChild(art);
    }
    slide.appendChild(caption);
    track.appendChild(slide);
  });

  bindCarouselInteractions(carousel, track);
}

// Bound once per page lifetime. Listeners attach to the carousel container
// and use event delegation to reach individual slides — this way the slides
// can be replaced wholesale by renderArtCarousel's `track.innerHTML = ''` reset
// without losing the bindings. A `data-bound` sentinel guards against the
// container-level listeners stacking up across bundle reloads.
function bindCarouselInteractions(carousel, track) {
  if (carousel.dataset.bound === 'yes') return;
  carousel.dataset.bound = 'yes';

  carousel.addEventListener('mouseenter', () => {
    isHoverPaused = true;
    isMarqueeRunning = false;
  });
  carousel.addEventListener('mouseleave', () => {
    isHoverPaused = false;
    if (!dragState) resumeMarquee();
  });

  carousel.addEventListener('pointerdown', (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    const slide = e.target.closest('.art-carousel-slide');
    if (!slide) return;
    dragState = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      trackXAtStart: currentTranslateX,
      isDragging: false,
      slideClicked: slide,
    };
    try { carousel.setPointerCapture(e.pointerId); } catch (_) {}
  });

  carousel.addEventListener('pointermove', (e) => {
    if (!dragState || e.pointerId !== dragState.pointerId) return;
    const dx = e.clientX - dragState.startX;
    if (!dragState.isDragging && Math.abs(dx) > DRAG_THRESHOLD_PX) {
      dragState.isDragging = true;
      carousel.classList.add('is-dragging');
      isMarqueeRunning = false;
    }
    if (dragState.isDragging) {
      currentTranslateX = wrapTranslateX(dragState.trackXAtStart + dx);
      applyTrackTransform();
      e.preventDefault();
    }
  });

  const endDrag = (e) => {
    if (!dragState || e.pointerId !== dragState.pointerId) return;
    const wasDragging = dragState.isDragging;
    const slide = dragState.slideClicked;
    try { carousel.releasePointerCapture(e.pointerId); } catch (_) {}
    dragState = null;
    carousel.classList.remove('is-dragging');
    if (wasDragging) {
      if (!isHoverPaused) resumeMarquee();
      return;
    }
    // No-drag pointer-up on a slide = click/tap → open the lightbox. Single
    // gesture, same behavior on PC mouse and mobile touch.
    if (slide) openLightbox(slide);
  };
  carousel.addEventListener('pointerup', endDrag);
  carousel.addEventListener('pointercancel', endDrag);
}

function wrapTranslateX(x) {
  if (halfTrackWidth <= 0) return x;
  while (x > 0) x -= halfTrackWidth;
  while (x < -halfTrackWidth) x += halfTrackWidth;
  return x;
}

function applyTrackTransform() {
  const track = document.getElementById('art-carousel-track');
  if (track) track.style.transform = `translateX(${currentTranslateX}px)`;
}

function startMarquee() {
  const track = document.getElementById('art-carousel-track');
  if (!track || !track.children.length) return;
  // Defer one frame so images have laid out and scrollWidth is real.
  requestAnimationFrame(() => {
    halfTrackWidth = track.scrollWidth / 2;
    if (!halfTrackWidth) return;
    isMarqueeRunning = true;
    lastMarqueeFrameTime = performance.now();
    if (marqueeRafId === null) {
      marqueeRafId = requestAnimationFrame(marqueeStep);
    }
  });
}

function stopMarquee() {
  isMarqueeRunning = false;
  if (marqueeRafId !== null) {
    cancelAnimationFrame(marqueeRafId);
    marqueeRafId = null;
  }
  halfTrackWidth = 0;
}

function resumeMarquee() {
  const track = document.getElementById('art-carousel-track');
  if (!track || !track.children.length) return;
  // Recompute halfTrackWidth in case layout changed (rare, but cheap).
  halfTrackWidth = track.scrollWidth / 2;
  if (!halfTrackWidth) return;
  currentTranslateX = wrapTranslateX(currentTranslateX);
  isMarqueeRunning = true;
  lastMarqueeFrameTime = performance.now();
  if (marqueeRafId === null) {
    marqueeRafId = requestAnimationFrame(marqueeStep);
  }
}

function marqueeStep(t) {
  marqueeRafId = requestAnimationFrame(marqueeStep);
  if (!isMarqueeRunning) {
    lastMarqueeFrameTime = t;
    return;
  }
  const dt = (t - lastMarqueeFrameTime) / 1000;
  lastMarqueeFrameTime = t;
  currentTranslateX = wrapTranslateX(currentTranslateX - MARQUEE_SPEED_PX_S * dt);
  applyTrackTransform();
}

function openLightbox(slide) {
  const sourceIdx = parseInt(slide.dataset.sourceIdx, 10);
  // Idempotent on the same slide: if a lightbox is already up for this
  // sourceIdx, do nothing. Defensive — there's only one code path triggering
  // openLightbox now (single-click on a non-dragged slide), but the guard
  // keeps the function safe to call from anywhere.
  if (activeLightbox && activeLightbox.dataset.sourceIdx === String(sourceIdx)) {
    return;
  }
  closeLightbox();
  const data = currentCarouselCards[sourceIdx];
  if (!data) return;

  const overlay = document.createElement('div');
  overlay.className = 'lightbox-overlay';
  overlay.dataset.sourceIdx = String(sourceIdx);

  const img = document.createElement('img');
  img.className = 'lightbox-image';
  img.src = data.art_crop_url;
  img.alt = data.name || '';
  overlay.appendChild(img);

  const caption = document.createElement('div');
  caption.className = 'lightbox-caption';
  const nm = document.createElement('span');
  nm.className = 'lb-name';
  nm.textContent = data.name || '';
  caption.appendChild(nm);
  if (data.artist) {
    const art = document.createElement('span');
    art.className = 'lb-artist';
    art.textContent = data.artist;
    caption.appendChild(art);
  }
  const metaParts = [data.set, data.collector_number && `#${data.collector_number}`].filter(Boolean);
  if (metaParts.length) {
    const meta = document.createElement('span');
    meta.className = 'lb-meta';
    meta.textContent = metaParts.join(' · ');
    caption.appendChild(meta);
  }
  overlay.appendChild(caption);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'lightbox-close';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.textContent = '×';
  overlay.appendChild(closeBtn);

  // Click anywhere on the overlay closes; clicks on the image or caption
  // shouldn't bubble up to trigger close.
  overlay.addEventListener('click', closeLightbox);
  img.addEventListener('click', (e) => e.stopPropagation());
  caption.addEventListener('click', (e) => e.stopPropagation());
  closeBtn.addEventListener('click', (e) => { e.stopPropagation(); closeLightbox(); });

  document.body.appendChild(overlay);
  activeLightbox = overlay;
  document.addEventListener('keydown', lightboxKeyHandler);

  // Pause the marquee while lightbox is open; resume on close.
  isMarqueeRunning = false;
}

function closeLightbox() {
  if (!activeLightbox) return;
  activeLightbox.remove();
  activeLightbox = null;
  document.removeEventListener('keydown', lightboxKeyHandler);
  // Only resume if the carousel isn't currently hovered or being dragged.
  if (!isHoverPaused && !dragState) resumeMarquee();
}

function lightboxKeyHandler(e) {
  if (e.key === 'Escape') closeLightbox();
}

function renderCardGrid(cards) {
  const container = document.getElementById('card-grid');
  container.innerHTML = '';
  cards.forEach((card, idx) => {
    const tile = document.createElement('div');
    tile.className = 'card-tile';
    tile.dataset.idx = idx;

    const img = document.createElement('img');
    img.src = card.image_url || '';
    img.alt = card.name || `Card ${idx + 1}`;
    img.loading = 'lazy';
    img.onerror = () => {
      img.style.display = 'none';
      const placeholder = document.createElement('div');
      placeholder.style.cssText = 'width:100%;aspect-ratio:488/680;background:#DDD;display:flex;align-items:center;justify-content:center;color:#888;font-size:0.85em;text-align:center;padding:8px;';
      placeholder.textContent = '(image unavailable)';
      tile.insertBefore(placeholder, tile.firstChild);
    };
    tile.appendChild(img);

    if (card.qty_in_bundle && card.qty_in_bundle > 1) {
      const qty = document.createElement('span');
      qty.className = 'qty-pill';
      qty.textContent = `${card.qty_in_bundle}× in bundle`;
      tile.appendChild(qty);
    }

    const name = document.createElement('h3');
    name.className = 'card-name';
    name.textContent = card.name || '(unnamed)';
    tile.appendChild(name);

    const meta = document.createElement('div');
    meta.className = 'card-meta';
    const metaParts = [card.set, card.collector_number && `#${card.collector_number}`].filter(Boolean);
    if (card.market_price_usd != null) {
      let mktStr = `mkt ${fmtUsd(card.market_price_usd)}`;
      if (card.market_price_as_of) {
        mktStr += ` (as of ${card.market_price_as_of})`;
      }
      metaParts.push(mktStr);
    }
    meta.textContent = metaParts.join(' · ');
    tile.appendChild(meta);

    if (card.tags_matched && card.tags_matched.length) {
      const tagRow = document.createElement('div');
      tagRow.className = 'card-tags';
      card.tags_matched.forEach(t => {
        const tag = document.createElement('span');
        tag.className = 'card-tag';
        tag.textContent = t;
        tagRow.appendChild(tag);
      });
      tile.appendChild(tagRow);
    }

    if (card.why_it_fits) {
      const why = document.createElement('div');
      why.className = 'why-it-fits';
      why.textContent = card.why_it_fits;
      tile.appendChild(why);
    }

    container.appendChild(tile);
  });
}

function renderCohesion(c) {
  document.getElementById('cohesion-mood').textContent = c.mood || '(unset)';
  document.getElementById('cohesion-register').textContent = c.register || '(unset)';
  document.getElementById('cohesion-sets').textContent = (c.set_diversity || []).join(', ') || '(unset)';
  document.getElementById('cohesion-colors').textContent = (c.color_identities_present || []).join(', ') || '(unset)';

  const paletteEl = document.getElementById('cohesion-palette');
  paletteEl.innerHTML = '';
  (c.palette_hex || []).forEach(hex => {
    const sw = document.createElement('span');
    sw.className = 'swatch';
    sw.style.backgroundColor = hex;
    sw.title = hex;
    paletteEl.appendChild(sw);
  });
  if (!(c.palette_hex || []).length) {
    paletteEl.textContent = '(unset)';
  }
}

function renderPricing(p) {
  const panel = document.getElementById('pricing-panel');
  const receiptEl = document.getElementById('receipt');
  const justEl = document.getElementById('pricing-justification');
  const shipEl = document.getElementById('pricing-shipping-note');
  if (!p) {
    panel.style.display = 'none';
    return;
  }
  panel.style.display = '';
  receiptEl.innerHTML = '';

  const addSection = (label) => {
    const s = document.createElement('div');
    s.className = 'receipt-section';
    s.textContent = label;
    receiptEl.appendChild(s);
  };
  const addRow = (label, value, cls) => {
    if (value === '' || value == null) return;
    const row = document.createElement('div');
    row.className = 'receipt-row' + (cls ? ' ' + cls : '');
    const l = document.createElement('span'); l.className = 'receipt-label'; l.textContent = label;
    const v = document.createElement('span'); v.className = 'receipt-value'; v.textContent = value;
    row.appendChild(l); row.appendChild(v);
    receiptEl.appendChild(row);
  };

  // Section 1: what BBL puts into it
  addSection('what BBL puts in');
  addRow('Card value subtotal', fmtUsd(p.card_value_subtotal_usd));
  addRow(`Labor + sleeve (${p.card_count || ''} × ${fmtUsd(p.labor_and_sleeve_per_card_usd)})`.replace('(  × ', '('), fmtUsd(p.labor_and_sleeve_total_usd), 'subtle');
  addRow('Cost basis', fmtUsd(p.cost_basis_usd), 'subtotal');

  // Section 2: what DIY would cost
  addSection('what DIY would cost');
  const diyLabel = p.diy_seller_count_estimate
    ? `Cards + ${p.diy_seller_count_estimate}-seller shipping at ${fmtUsd(p.diy_shipping_per_seller_usd)}`
    : 'DIY alternative';
  addRow(diyLabel, fmtUsd(p.diy_alternative_usd));

  // Section 3: the headline + breakdown
  addRow(
    `BUNDLE LIST PRICE${p.bundle_price_floor_usd ? ' (floor ' + fmtUsd(p.bundle_price_floor_usd) + ')' : ''}`,
    fmtUsd(p.bundle_list_price_usd),
    'headline'
  );

  addSection('breakdown');
  addRow('Narrative premium (curation)', fmtUsd(p.narrative_premium_usd));
  addRow(
    'Buyer savings vs DIY',
    fmtUsd(p.buyer_savings_vs_diy_usd) + (p.buyer_savings_vs_diy_pct != null ? `  (${p.buyer_savings_vs_diy_pct}%)` : ''),
    'savings'
  );

  justEl.textContent = p.premium_justification || '';
  justEl.style.display = p.premium_justification ? '' : 'none';

  const shipParts = [];
  if (p.shipping_policy) shipParts.push(p.shipping_policy);
  if (p.estimated_shipping_usd != null) shipParts.push('est. ' + fmtUsd(p.estimated_shipping_usd) + ' PWE');
  shipEl.textContent = shipParts.length ? ('+ shipping: ' + shipParts.join(' · ')) : '';
  shipEl.style.display = shipParts.length ? '' : 'none';
}

function renderCheckout(c, pricing, title) {
  const row = document.getElementById('checkout-row');
  row.innerHTML = '';
  const url = c && c.stripe_payment_url;
  const price = pricing && pricing.bundle_list_price_usd;
  if (url && /^https:\/\//.test(url) && !/PLACEHOLDER/i.test(url)) {
    const btn = document.createElement('a');
    btn.className = 'buy-button';
    btn.href = url;
    btn.target = '_blank';
    btn.rel = 'noopener noreferrer';
    btn.textContent = price != null ? `Buy — ${fmtUsd(price)}` : 'Buy this bundle';
    row.appendChild(btn);

    const meta = document.createElement('div');
    meta.className = 'checkout-meta';
    meta.textContent = `+ shipping at checkout · ${title || 'this bundle'} is edition 1 of 1`;
    row.appendChild(meta);

    const sec = document.createElement('div');
    sec.className = 'checkout-secured';
    sec.textContent = 'secured by Stripe';
    row.appendChild(sec);
    return;
  }
  if (url && /PLACEHOLDER/i.test(url)) {
    const disabled = document.createElement('span');
    disabled.className = 'buy-button-disabled';
    disabled.textContent = price != null ? `Buy — ${fmtUsd(price)} (Stripe link pending)` : 'Buy (Stripe link pending)';
    row.appendChild(disabled);
    const meta = document.createElement('div');
    meta.className = 'checkout-meta';
    meta.textContent = 'Stripe Payment Link not configured yet for this bundle. Fill in checkout.stripe_payment_url to enable.';
    row.appendChild(meta);
    return;
  }
  // No checkout block at all; render nothing.
}

function fmtUsd(n) {
  if (n === null || n === undefined || n === '') return '';
  const num = typeof n === 'number' ? n : parseFloat(n);
  if (!isFinite(num)) return '';
  return '$' + num.toFixed(2);
}

function renderMetadata(m, cardCount) {
  const parts = [];
  if (m.edition_size) parts.push(`<strong>Edition:</strong> ${escapeHtml(m.edition_size)}`);
  if (m.price_floor_usd) parts.push(`<strong>Floor:</strong> $${m.price_floor_usd}`);
  if (cardCount) parts.push(`<strong>Cards:</strong> ${cardCount}`);
  if (m.rarity_distribution) {
    const rd = m.rarity_distribution;
    const rdStr = Object.entries(rd).filter(([, v]) => v > 0).map(([k, v]) => `${v} ${k}`).join(', ');
    if (rdStr) parts.push(`<strong>Rarity mix:</strong> ${escapeHtml(rdStr)}`);
  }
  if (m.generated_by) parts.push(`<strong>Generated by:</strong> ${escapeHtml(m.generated_by)}`);
  if (m.generated_at) parts.push(`<strong>At:</strong> ${escapeHtml(m.generated_at)}`);
  document.getElementById('metadata').innerHTML = parts.join(' &nbsp; · &nbsp; ');
}

// ── Animations ─────────────────────────────────────────────────────────────

function animateEntrance() {
  // Hub badges spring-in from above.
  const hubs = document.querySelectorAll('.hub-badge');
  if (hubs.length) {
    animate(hubs, {
      translateY: [-30, 0],
      opacity: [0, 1],
      duration: 600,
      delay: stagger(80),
      ease: 'outBack',
    });
  }

  // Title chars stagger from center.
  const chars = document.querySelectorAll('.title .char');
  if (chars.length) {
    animate(chars, {
      opacity: [0, 1],
      translateY: [20, 0],
      duration: 500,
      delay: stagger(30, { from: 'center', start: 200 }),
      ease: 'outQuad',
    });
  }

  // Subtitle + narrative fade in.
  animate(['.subtitle', '.narrative'], {
    opacity: [0, 1],
    translateY: [10, 0],
    duration: 600,
    delay: stagger(200, { start: 500 }),
    ease: 'outQuad',
  });

  // Anchor tags pop in.
  const anchors = document.querySelectorAll('.anchor-tag');
  if (anchors.length) {
    animate(anchors, {
      scale: [0.3, 1],
      opacity: [0, 1],
      duration: 400,
      delay: stagger(60, { start: 800 }),
      ease: 'outBack',
    });
  }

  // Art carousel: fade the whole section in, then kick off the marquee.
  const carouselSection = document.getElementById('art-carousel-section');
  if (carouselSection && carouselSection.style.display !== 'none') {
    animate('.art-carousel-section', {
      opacity: [0, 1],
      translateY: [20, 0],
      duration: 600,
      delay: 900,
      ease: 'outQuad',
    });
    // Slides themselves zoom in slightly before the marquee starts moving.
    const slides = document.querySelectorAll('.art-carousel-slide');
    if (slides.length) {
      animate(slides, {
        opacity: [0, 1],
        scale: [0.85, 1],
        duration: 500,
        delay: stagger(40, { start: 1000 }),
        ease: 'outQuad',
      });
    }
    // Defer the marquee until the entrance animations clear.
    setTimeout(() => { startMarquee(); }, 1800);
  }

  // Card tiles stagger in from the grid center.
  const tiles = document.querySelectorAll('.card-tile');
  if (tiles.length) {
    animate(tiles, {
      opacity: [0, 1],
      scale: [0.9, 1],
      translateY: [20, 0],
      duration: 500,
      delay: stagger(80, { from: 'center', start: 1000 }),
      ease: 'outQuad',
    });
  }

  // Cohesion + pricing panels slide-up in sequence.
  animate('.cohesion', {
    opacity: [0, 1],
    translateY: [20, 0],
    duration: 500,
    delay: 1400,
    ease: 'outQuad',
  });

  if (document.getElementById('pricing-panel').style.display !== 'none') {
    animate('.pricing', {
      opacity: [0, 1],
      translateY: [20, 0],
      duration: 500,
      delay: 1600,
      ease: 'outQuad',
    });
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Boot ───────────────────────────────────────────────────────────────────

(async () => {
  // Dev-picker handoff: when the hub's file picker routes us here with
  // ?source=dev, the bundle JSON is stashed in sessionStorage. Pull it,
  // clear the key, and render directly without a fetch.
  const params = new URLSearchParams(window.location.search);
  if (params.get('source') === 'dev') {
    const stashed = sessionStorage.getItem('bbl-dev-bundle');
    if (stashed) {
      try {
        const bundle = JSON.parse(stashed);
        sessionStorage.removeItem('bbl-dev-bundle');
        render(bundle);
        return;
      } catch (err) {
        showError(`Stashed dev bundle JSON didn't parse: ${err.message}`);
        sessionStorage.removeItem('bbl-dev-bundle');
        return;
      }
    }
  }
  const bundle = await loadDefaultBundle();
  if (bundle) render(bundle);
})();
