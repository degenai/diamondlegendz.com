// BBL Catalog hub — renders sample-bundles/_manifest.json into a grid of
// clickable lair tiles. Each tile links to lair.html?lair=<slug> which loads
// the corresponding sample-bundles/<slug>.json via the bundle viewer.
//
// Anti-AI-slop note: the thumbnails on each tile are real card art_crops from
// the lair itself, NOT generated images. Per Alex's brand rule, no straight
// AI image generation appears in buyer-facing visuals — composition only.

import { animate, stagger } from '../facets/vendor/anime.esm.min.js';

const MANIFEST_PATH = 'sample-bundles/_manifest.json';

(async () => {
  const manifest = await loadManifest();
  if (!manifest) return;
  renderHub(manifest);
})();

async function loadManifest() {
  try {
    const resp = await fetch(MANIFEST_PATH);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.json();
  } catch (e) {
    showError(
      `Couldn't load the catalog manifest (${e.message}). ` +
      `If you opened this page directly from disk, browsers block file:// fetches. ` +
      `Serve the directory with \`python -m http.server\` and reload.`
    );
    return null;
  }
}

function showError(msg) {
  const slot = document.getElementById('error-slot');
  if (slot) slot.innerHTML = `<div class="error">${escapeHtml(msg)}</div>`;
  const grid = document.getElementById('lair-grid');
  if (grid) grid.innerHTML = '';
}

function renderHub(manifest) {
  // Tagline (may contain HTML for emphasis — the source is trusted (our own
  // manifest), so innerHTML is acceptable here.)
  const tagEl = document.getElementById('tagline');
  if (tagEl && manifest.tagline_html) tagEl.innerHTML = manifest.tagline_html;

  const grid = document.getElementById('lair-grid');
  const lairs = (manifest.lairs || []).filter(l => l && l.slug && l.catalog_id);

  if (!grid) return;
  grid.innerHTML = '';

  if (!lairs.length) {
    grid.innerHTML = `<div class="empty">No lairs in the catalog yet. Check back soon.</div>`;
    return;
  }

  lairs.forEach((lair) => {
    grid.appendChild(buildLairTile(lair));
  });

  animateTilesIn();
  bindDevFilePicker();
}

function buildLairTile(lair) {
  const tile = document.createElement('a');
  tile.className = 'lair-tile';
  tile.href = `lair.html?lair=${encodeURIComponent(lair.slug)}`;
  tile.setAttribute('role', 'link');

  const catalog = document.createElement('p');
  catalog.className = 'lair-catalog-id';
  catalog.textContent = lair.catalog_id || '';
  tile.appendChild(catalog);

  const title = document.createElement('h2');
  title.className = 'lair-title';
  title.textContent = lair.title || '(untitled)';
  tile.appendChild(title);

  if (lair.subtitle) {
    const sub = document.createElement('p');
    sub.className = 'lair-subtitle';
    sub.textContent = lair.subtitle;
    tile.appendChild(sub);
  }

  if (Array.isArray(lair.hubs) && lair.hubs.length) {
    const hubsRow = document.createElement('div');
    hubsRow.className = 'lair-hubs';
    lair.hubs.forEach(h => {
      const badge = document.createElement('span');
      badge.className = 'lair-hub-badge';
      badge.textContent = h;
      hubsRow.appendChild(badge);
    });
    tile.appendChild(hubsRow);
  }

  if (Array.isArray(lair.anchor_tags) && lair.anchor_tags.length) {
    const anchors = document.createElement('p');
    anchors.className = 'lair-anchors';
    anchors.textContent = 'Anchors: ';
    lair.anchor_tags.slice(0, 6).forEach(t => {
      const pill = document.createElement('span');
      pill.className = 'anchor-pill';
      pill.textContent = t;
      anchors.appendChild(pill);
    });
    tile.appendChild(anchors);
  }

  if (lair.blurb) {
    const blurb = document.createElement('p');
    blurb.className = 'lair-blurb';
    blurb.textContent = lair.blurb;
    tile.appendChild(blurb);
  }

  if (Array.isArray(lair.thumbnails) && lair.thumbnails.length) {
    const thumbs = document.createElement('div');
    thumbs.className = 'lair-thumbnails';
    lair.thumbnails.slice(0, 4).forEach(url => {
      const img = document.createElement('img');
      img.src = url;
      img.alt = '';
      img.loading = 'lazy';
      img.draggable = false;
      thumbs.appendChild(img);
    });
    tile.appendChild(thumbs);
  }

  const meta = document.createElement('div');
  meta.className = 'lair-meta';
  const left = document.createElement('span');
  const parts = [];
  if (lair.distinct_card_count) parts.push(`${lair.distinct_card_count} cards`);
  else if (lair.card_count) parts.push(`${lair.card_count} cards`);
  if (lair.list_price_usd != null) {
    const priceSpan = document.createElement('span');
    priceSpan.className = 'lair-price';
    priceSpan.textContent = `$${Number(lair.list_price_usd).toFixed(2)}`;
    parts.push(priceSpan.outerHTML);
  }
  left.innerHTML = parts.join(' &nbsp;·&nbsp; ');
  meta.appendChild(left);

  const cta = document.createElement('span');
  cta.className = 'lair-cta';
  cta.textContent = 'open the lair →';
  meta.appendChild(cta);
  tile.appendChild(meta);

  return tile;
}

function animateTilesIn() {
  const tiles = document.querySelectorAll('.lair-tile');
  if (!tiles.length) return;
  animate(tiles, {
    opacity: [0, 1],
    translateY: [24, 0],
    scale: [0.96, 1],
    duration: 600,
    delay: stagger(120, { start: 100 }),
    ease: 'outBack',
  });
}

function bindDevFilePicker() {
  const input = document.getElementById('bundle-file');
  if (!input) return;
  input.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    // Stash the JSON in sessionStorage and bounce to the viewer in
    // "dev-injected bundle" mode. The viewer page will read it on load.
    try {
      const text = await file.text();
      JSON.parse(text);  // validate that it parses
      sessionStorage.setItem('bbl-dev-bundle', text);
      window.location.href = 'lair.html?source=dev';
    } catch (err) {
      showError(`Couldn't parse JSON: ${err.message}`);
    }
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
