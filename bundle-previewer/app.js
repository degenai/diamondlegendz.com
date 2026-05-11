// BBL Bundle Previewer — renders a bundle JSON into the page, with anime.js v4
// entrance animations. CSP-safe (no eval, no inline event handlers, no external
// scripts beyond facets/vendor/anime.esm.min.js). Internal dev tool for now;
// later may get a slimmed-down buyer-facing variant that drops the heatmap and
// raw JSON load controls.

import { animate, stagger } from '../facets/vendor/anime.esm.min.js';

// ── Bundle loading ─────────────────────────────────────────────────────────

const defaultPath = JSON.parse(document.getElementById('default-bundle-path').textContent);

async function loadDefaultBundle() {
  try {
    const resp = await fetch(defaultPath);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.json();
  } catch (e) {
    // Likely running via file:// — fetch is blocked by browsers for local files.
    // Surface a friendly message instructing user to use the file picker.
    showError(
      `Couldn't auto-load default bundle (${e.message}). ` +
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

// File-picker fallback path.
document.getElementById('bundle-file').addEventListener('change', async (e) => {
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
  const bundle = await loadDefaultBundle();
  if (bundle) render(bundle);
})();
