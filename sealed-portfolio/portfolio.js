const STORAGE_KEY = 'dlz_sealed_portfolio_v1';
const CATALOG_OVERLAY_KEY = 'dlz_catalog_overlay_v1';
const SCHEMA_VERSION = 2;

const SELL_VENUES = ['lgs', 'ebay', 'tcgplayer', 'reddit', 'discord', 'whatnot', 'show', 'direct', 'trade-out', 'other'];

let baselineCatalog = { products: [] };
let catalogOverlay = { added: [], modified: {}, deleted: [] };
let catalog = { products: [] };
let portfolio = { holdings: [] };
let sortState = { col: null, dir: 1 };

const SORT_COLS = {
  category:    { type: 'str', get: (h,p) => p.category || 'tcg' },
  game:        { type: 'str', get: (h,p) => p.game },
  set:         { type: 'str', get: (h,p) => p.set },
  product:     { type: 'str', get: (h,p) => p.product_type },
  acquisition: { type: 'str', get: (h,p) => h.acquisition || 'purchase' },
  msrp:        { type: 'num', get: (h,p) => p.msrp },
  buy:         { type: 'num', get: (h,p) => h.buy_price },
  buydate:     { type: 'str', get: (h,p) => h.buy_date || h.gift_date || '' },
  spot:        { type: 'num', get: (h,p) => { const s = latestPrice(h); return s ? s.price : null; } },
  cost:        { type: 'num', get: (h,p) => (h.buy_price || 0) * (h.qty || 1) },
  market:      { type: 'num', get: (h,p) => { const s = latestPrice(h); return s ? s.price * (h.qty||1) : null; } }
};

// ---------- catalog merge + persistence ----------

function mergeCatalog() {
  const byId = new Map();
  for (const p of baselineCatalog.products) byId.set(p.id, { ...p, _source: 'baseline' });
  for (const id of catalogOverlay.deleted) byId.delete(id);
  for (const [id, patch] of Object.entries(catalogOverlay.modified)) {
    if (byId.has(id)) byId.set(id, { ...byId.get(id), ...patch, _source: 'modified' });
  }
  for (const p of catalogOverlay.added) byId.set(p.id, { ...p, _source: 'added' });
  catalog = { products: [...byId.values()] };
}

function saveCatalogOverlay() {
  localStorage.setItem(CATALOG_OVERLAY_KEY, JSON.stringify(catalogOverlay));
}

function loadCatalogOverlay() {
  const raw = localStorage.getItem(CATALOG_OVERLAY_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    catalogOverlay = {
      added: Array.isArray(parsed.added) ? parsed.added : [],
      modified: (parsed.modified && typeof parsed.modified === 'object') ? parsed.modified : {},
      deleted: Array.isArray(parsed.deleted) ? parsed.deleted : []
    };
  } catch { catalogOverlay = { added: [], modified: {}, deleted: [] }; }
}

async function loadBaselineCatalog() {
  const res = await fetch('catalog.json');
  baselineCatalog = await res.json();
}

// ---------- portfolio persistence ----------

function loadPortfolio() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try { portfolio = JSON.parse(raw); } catch { portfolio = { holdings: [] }; }
  }
  if (!portfolio.holdings) portfolio.holdings = [];
  migratePortfolio();
}

function migratePortfolio() {
  // Schema v1 → v2: holdings gain a `status` field; portfolio gains schema_version.
  // Unknown fields on holdings are preserved untouched.
  if (!portfolio.schema_version || portfolio.schema_version < 2) {
    portfolio.schema_version = SCHEMA_VERSION;
  }
  for (const h of portfolio.holdings) {
    if (!h.status) h.status = 'held';
  }
}

function savePortfolio() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(portfolio));
}

// ---------- lookups ----------

function productById(id) {
  return catalog.products.find(p => p.id === id);
}

function latestPrice(h) {
  if (!h.price_checks || h.price_checks.length === 0) return null;
  const sorted = [...h.price_checks].sort((a,b) => b.date.localeCompare(a.date));
  return sorted[0];
}

function fmtMoney(n) {
  if (n == null || isNaN(n)) return '-';
  return '$' + Number(n).toFixed(2);
}

function categoryLabel(c) {
  if (c === 'figure') return 'FIG';
  if (c === 'model-kit') return 'KIT';
  if (c === 'other') return 'OTH';
  return 'TCG';
}

// ---------- sort ----------

function sortedHoldings() {
  const indexed = portfolio.holdings
    .map((h, i) => ({ h, i, p: productById(h.catalog_id) || { category:'?', game:'?', set:'?', product_type:'?', msrp:null } }))
    .filter(row => row.h.status !== 'sold');
  if (!sortState.col || !SORT_COLS[sortState.col]) return indexed;
  const cfg = SORT_COLS[sortState.col];
  const dir = sortState.dir;
  indexed.sort((a, b) => {
    const va = cfg.get(a.h, a.p);
    const vb = cfg.get(b.h, b.p);
    const an = va == null, bn = vb == null;
    if (an && bn) return 0;
    if (an) return 1;
    if (bn) return -1;
    if (cfg.type === 'num') return (va - vb) * dir;
    return String(va).localeCompare(String(vb)) * dir;
  });
  return indexed;
}

function onSortClick(e) {
  const col = e.currentTarget.dataset.sort;
  if (!col) return;
  if (sortState.col === col) sortState.dir = -sortState.dir;
  else { sortState.col = col; sortState.dir = 1; }
  renderTable();
}

function updateSortIndicators() {
  document.querySelectorAll('th[data-sort]').forEach(th => {
    const base = th.dataset.label || th.textContent.replace(/[▲▼]/g,'').trim();
    th.dataset.label = base;
    if (th.dataset.sort === sortState.col) {
      th.textContent = base + (sortState.dir === 1 ? ' ▲' : ' ▼');
    } else {
      th.textContent = base;
    }
  });
}

// ---------- holdings render ----------

function renderCatalogOptions() {
  const sel = document.getElementById('catalog-select');
  const heldIds = new Set(portfolio.holdings.filter(h => h.status !== 'sold').map(h => h.catalog_id));
  sel.innerHTML = '<option value="">-- select product --</option>';
  for (const p of catalog.products) {
    const opt = document.createElement('option');
    opt.value = p.id;
    const owned = heldIds.has(p.id) ? ' [currently held]' : '';
    opt.textContent = `[${categoryLabel(p.category)}] ${p.game} — ${p.set} ${p.product_type}${owned}`;
    if (heldIds.has(p.id)) opt.disabled = true;
    sel.appendChild(opt);
  }
}

function acquisitionBadge(h) {
  const a = h.acquisition || 'purchase';
  if (a === 'gift')  return `<span class="badge badge-gift">GIFT${h.gift_from ? ' ← ' + escapeHtml(h.gift_from) : ''}</span>`;
  if (a === 'trade') return `<span class="badge badge-trade">TRADE</span>`;
  if (a === 'pull')  return `<span class="badge badge-pull">PULL</span>`;
  return '';
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function renderTable() {
  const tbody = document.getElementById('holdings-body');
  tbody.innerHTML = '';

  for (const row of sortedHoldings()) {
    const h = row.h, p = row.p, i = row.i;
    const spot = latestPrice(h);
    const spotVal = spot ? spot.price : null;
    const costBasis = (h.buy_price || 0) * (h.qty || 1);
    const marketVal = (spotVal || 0) * (h.qty || 1);

    const isGift = h.acquisition === 'gift';
    const dateDisplay = h.buy_date || h.gift_date || '-';

    const tr = document.createElement('tr');
    if (isGift) tr.className = 'row-gift';
    tr.innerHTML = `
      <td>${categoryLabel(p.category)}</td>
      <td>${escapeHtml(p.game)}</td>
      <td>${escapeHtml(p.set)} <small>(${escapeHtml(p.set_code || '-')})</small></td>
      <td>${escapeHtml(p.product_type)}</td>
      <td>${acquisitionBadge(h) || '<small>—</small>'}</td>
      <td>${fmtMoney(p.msrp)}</td>
      <td>${fmtMoney(h.buy_price)}</td>
      <td>${dateDisplay}</td>
      <td>${fmtMoney(spotVal)} ${spot ? `<br><small>${spot.date} ${escapeHtml(spot.source||'')}</small>` : ''}</td>
      <td>${fmtMoney(costBasis)}${isGift && h.gift_fmv != null ? `<br><small>FMV ${fmtMoney(h.gift_fmv)}</small>` : ''}</td>
      <td>${spotVal != null ? fmtMoney(marketVal) : '-'}</td>
      <td>
        <button data-idx="${i}" class="btn-price">+ price</button>
        <button data-idx="${i}" class="btn-history">history</button>
        <button data-idx="${i}" class="btn-sell">sell</button>
        <button data-idx="${i}" class="btn-del">x</button>
      </td>
    `;
    tbody.appendChild(tr);

    if (h.notes || (h.price_checks && h.price_checks.length > 0)) {
      const notesTr = document.createElement('tr');
      notesTr.className = 'notes-row';
      notesTr.dataset.holdingIdx = i;
      notesTr.style.display = 'none';
      notesTr.innerHTML = `<td colspan="12">${renderNotesAndHistory(h)}</td>`;
      tbody.appendChild(notesTr);
    }
  }

  updateSortIndicators();

  tbody.querySelectorAll('.btn-del').forEach(b => b.addEventListener('click', onDelete));
  tbody.querySelectorAll('.btn-price').forEach(b => b.addEventListener('click', onAddPrice));
  tbody.querySelectorAll('.btn-history').forEach(b => b.addEventListener('click', onToggleHistory));
  tbody.querySelectorAll('.btn-sell').forEach(b => b.addEventListener('click', onToggleSellForm));

  renderClosedTable();
  renderTotals();
  renderChart();
}

function renderTotals() {
  let heldCost = 0, heldMarket = 0;
  let closedCost = 0, closedGross = 0, closedFees = 0;

  for (const h of portfolio.holdings) {
    const qty = h.qty || 1;
    const cost = (h.buy_price || 0) * qty;
    if (h.status === 'sold') {
      closedCost += cost;
      closedGross += (h.sell_price || 0) * qty;
      closedFees += (h.sell_fees || 0);
    } else {
      heldCost += cost;
      const spot = latestPrice(h);
      if (spot) heldMarket += spot.price * qty;
    }
  }
  const closedNet = closedGross - closedFees;
  const realized = closedNet - closedCost;
  const unrealized = heldMarket - heldCost;

  document.getElementById('total-cost').textContent = fmtMoney(heldCost);
  document.getElementById('total-market').textContent = fmtMoney(heldMarket);
  document.getElementById('total-pl').textContent = fmtMoney(unrealized);
  document.getElementById('closed-cost').textContent = fmtMoney(closedCost);
  document.getElementById('closed-net').textContent = fmtMoney(closedNet);
  document.getElementById('closed-pl').textContent = fmtMoney(realized);
  document.getElementById('lifetime-pl').textContent = fmtMoney(unrealized + realized);
}

function renderClosedTable() {
  const tbody = document.getElementById('closed-body');
  if (!tbody) return;
  tbody.innerHTML = '';
  const closed = portfolio.holdings
    .map((h, i) => ({ h, i, p: productById(h.catalog_id) || { category:'?', game:'?', product_type:'?' } }))
    .filter(r => r.h.status === 'sold')
    .sort((a, b) => String(b.h.sell_date || '').localeCompare(String(a.h.sell_date || '')));

  for (const row of closed) {
    const h = row.h, p = row.p, i = row.i;
    const qty = h.qty || 1;
    const cost = (h.buy_price || 0) * qty;
    const gross = (h.sell_price || 0) * qty;
    const fees = h.sell_fees || 0;
    const net = gross - fees;
    const realized = net - cost;
    const plColor = realized >= 0 ? '#00FF00' : '#FF5555';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${categoryLabel(p.category)}</td>
      <td>${escapeHtml(p.game)}</td>
      <td>${escapeHtml(p.product_type)} <small>${escapeHtml(p.set_code || '')}</small></td>
      <td>${acquisitionBadge(h) || '<small>—</small>'}</td>
      <td>${fmtMoney(cost)}</td>
      <td>${h.sell_date || '-'}</td>
      <td><small>${escapeHtml(h.sell_venue || '-')}</small></td>
      <td>${fmtMoney(gross)}</td>
      <td>${fmtMoney(fees)}</td>
      <td>${fmtMoney(net)}</td>
      <td style="color:${plColor}; font-weight:bold;">${fmtMoney(realized)}</td>
      <td>
        <button data-idx="${i}" class="btn-unsell">unsell</button>
        <button data-idx="${i}" class="btn-del">x</button>
      </td>
    `;
    tbody.appendChild(tr);

    if (h.sell_notes) {
      const noteTr = document.createElement('tr');
      noteTr.className = 'notes-row';
      noteTr.innerHTML = `<td colspan="12"><strong>Sell notes:</strong> ${escapeHtml(h.sell_notes)}</td>`;
      tbody.appendChild(noteTr);
    }
  }
  tbody.querySelectorAll('.btn-unsell').forEach(b => b.addEventListener('click', onUnsell));
  tbody.querySelectorAll('.btn-del').forEach(b => b.addEventListener('click', onDelete));
}

function onToggleSellForm(e) {
  const i = +e.target.dataset.idx;
  const rowAbove = e.target.closest('tr');
  const existing = document.querySelector(`tr.sell-form-row[data-holding-idx="${i}"]`);
  if (existing) { existing.remove(); return; }

  const today = new Date().toISOString().slice(0,10);
  const venueOptions = SELL_VENUES.map(v => `<option value="${v}">${v}</option>`).join('');
  const formRow = document.createElement('tr');
  formRow.className = 'sell-form-row';
  formRow.dataset.holdingIdx = i;
  formRow.innerHTML = `
    <td colspan="12" style="text-align:left; background:#002020; padding:10px;">
      <form class="sell-form-inline">
        <strong style="color:#FF00FF;">Mark as Sold</strong><br>
        <label>Sell date:</label>
        <input type="date" name="sell_date" value="${today}" required>
        <label>Sell $ (per unit):</label>
        <input type="number" step="0.01" name="sell_price" required>
        <label>Venue:</label>
        <select name="sell_venue">${venueOptions}</select>
        <label>Fees + ship:</label>
        <input type="number" step="0.01" name="sell_fees" value="0">
        <br>
        <label>Notes:</label>
        <input type="text" name="sell_notes" size="50" placeholder="buyer, condition at sale, anything else">
        <br>
        <button type="submit" style="margin-top:6px;">Confirm Sale</button>
        <button type="button" class="cancel-sell">Cancel</button>
      </form>
    </td>
  `;
  rowAbove.after(formRow);
  formRow.querySelector('.sell-form-inline').addEventListener('submit', ev => onSellSubmit(ev, i));
  formRow.querySelector('.cancel-sell').addEventListener('click', () => formRow.remove());
}

function onSellSubmit(e, i) {
  e.preventDefault();
  const form = e.target;
  const fd = new FormData(form);
  const h = portfolio.holdings[i];
  if (!h) return;
  h.status = 'sold';
  h.sell_date = fd.get('sell_date') || null;
  h.sell_price = parseFloat(fd.get('sell_price'));
  h.sell_venue = fd.get('sell_venue') || 'other';
  const fees = parseFloat(fd.get('sell_fees'));
  h.sell_fees = isNaN(fees) ? 0 : fees;
  h.sell_notes = fd.get('sell_notes') || '';
  savePortfolio();
  renderTable();
  renderCatalogOptions();
}

function onUnsell(e) {
  const i = +e.target.dataset.idx;
  const h = portfolio.holdings[i];
  if (!h) return;
  const dupeHeld = portfolio.holdings.some((other, j) => j !== i && other.catalog_id === h.catalog_id && other.status !== 'sold');
  if (dupeHeld) {
    alert('Cannot unsell — you already hold this SKU again. Delete the held record first, or delete this closed one.');
    return;
  }
  if (!confirm('Revert this position to Held? Sell details will be cleared.')) return;
  h.status = 'held';
  delete h.sell_date;
  delete h.sell_price;
  delete h.sell_venue;
  delete h.sell_fees;
  delete h.sell_notes;
  savePortfolio();
  renderTable();
  renderCatalogOptions();
}

function renderNotesAndHistory(h) {
  let html = '';
  if (h.notes) html += `<div><strong>Notes:</strong> ${escapeHtml(h.notes)}</div>`;
  if (h.price_checks && h.price_checks.length > 0) {
    const sorted = [...h.price_checks].sort((a,b) => a.date.localeCompare(b.date));
    html += `<div class="price-history"><strong>Price history:</strong><table>
      <thead><tr><th>Date</th><th>Price</th><th>Source</th></tr></thead>
      <tbody>${sorted.map(c => `<tr><td>${c.date}</td><td>${fmtMoney(c.price)}</td><td>${escapeHtml(c.source || '-')}</td></tr>`).join('')}</tbody>
    </table></div>`;
  }
  return html;
}

function onToggleHistory(e) {
  const i = +e.target.dataset.idx;
  const row = document.querySelector(`.notes-row[data-holding-idx="${i}"]`);
  if (!row) return;
  row.style.display = row.style.display === 'none' ? '' : 'none';
}

function onDelete(e) {
  const i = +e.target.dataset.idx;
  if (!confirm('Delete this holding?')) return;
  portfolio.holdings.splice(i, 1);
  savePortfolio();
  renderTable();
  renderCatalogOptions();
}

function onAddPrice(e) {
  const i = +e.target.dataset.idx;
  const h = portfolio.holdings[i];
  const priceStr = prompt('Spot price (per unit)?');
  if (!priceStr) return;
  const price = parseFloat(priceStr);
  if (isNaN(price)) { alert('not a number'); return; }
  const source = prompt('Source? (e.g. tcgplayer, mtggoldfish, ebay-sold, mandarake)', 'tcgplayer') || '';
  const dateInput = prompt('Date? (YYYY-MM-DD, blank = today)', '') || '';
  const date = dateInput.trim() || new Date().toISOString().slice(0,10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { alert('bad date format'); return; }
  if (!h.price_checks) h.price_checks = [];
  h.price_checks.push({ date, price, source });
  savePortfolio();
  renderTable();
}

function onAcquisitionChange() {
  const v = document.getElementById('acquisition').value;
  document.getElementById('gift-fields').style.display = v === 'gift' ? 'block' : 'none';
  document.getElementById('purchase-fields').style.display = v === 'gift' ? 'none' : 'block';
}

function onAddHolding(e) {
  e.preventDefault();
  const id = document.getElementById('catalog-select').value;
  if (!id) { alert('pick a product'); return; }
  if (portfolio.holdings.some(h => h.catalog_id === id && h.status !== 'sold')) {
    alert('Already hold this SKU. Singleton mode — one per product.');
    return;
  }
  const acquisition = document.getElementById('acquisition').value;
  const qty = parseInt(document.getElementById('qty').value) || 1;
  const notes = document.getElementById('notes').value;

  const record = {
    catalog_id: id,
    qty,
    acquisition,
    status: 'held',
    notes: notes || '',
    price_checks: []
  };

  if (acquisition === 'gift') {
    const giftFrom = document.getElementById('gift-from').value.trim();
    const giftDate = document.getElementById('gift-date').value;
    const giftFmv = parseFloat(document.getElementById('gift-fmv').value);
    record.buy_price = 0;
    record.buy_date = null;
    record.gift_from = giftFrom || null;
    record.gift_date = giftDate || null;
    record.gift_fmv = isNaN(giftFmv) ? null : giftFmv;
  } else {
    const buy_price = parseFloat(document.getElementById('buy-price').value);
    const buy_date = document.getElementById('buy-date').value;
    record.buy_price = isNaN(buy_price) ? null : buy_price;
    record.buy_date = buy_date || null;
  }

  portfolio.holdings.push(record);
  savePortfolio();
  renderTable();
  renderCatalogOptions();
  e.target.reset();
  onAcquisitionChange();
}

// ---------- export / import portfolio ----------

function onExport() {
  const blob = new Blob([JSON.stringify(portfolio, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `portfolio-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function onImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const data = JSON.parse(ev.target.result);
      if (!data.holdings || !Array.isArray(data.holdings)) throw new Error('missing or invalid holdings');
      if (!confirm(`Replace current portfolio with imported data (${data.holdings.length} holdings, schema v${data.schema_version || 1})?`)) return;
      portfolio = data;
      migratePortfolio();
      savePortfolio();
      renderTable();
      renderCatalogOptions();
    } catch (err) {
      alert('import failed: ' + err.message);
    }
  };
  reader.readAsText(file);
}

// ---------- catalog wizard ----------

function renderCatalogTable() {
  const tbody = document.getElementById('catalog-body');
  tbody.innerHTML = '';
  const sorted = [...catalog.products].sort((a,b) => (a.category||'tcg').localeCompare(b.category||'tcg') || a.id.localeCompare(b.id));
  for (const p of sorted) {
    const tr = document.createElement('tr');
    const sourceBadge = p._source === 'added'
      ? '<span class="badge badge-added">LOCAL</span>'
      : p._source === 'modified'
        ? '<span class="badge badge-modified">EDITED</span>'
        : '<span class="badge badge-cat">SHIPPED</span>';
    tr.innerHTML = `
      <td>${categoryLabel(p.category)}</td>
      <td><small>${escapeHtml(p.id)}</small></td>
      <td>${escapeHtml(p.game)}</td>
      <td>${escapeHtml(p.set)} <small>(${escapeHtml(p.set_code || '-')})</small></td>
      <td>${escapeHtml(p.product_type)}</td>
      <td>${fmtMoney(p.msrp)}</td>
      <td>${sourceBadge}</td>
      <td>
        <button data-id="${escapeHtml(p.id)}" class="btn-cat-edit">edit</button>
        <button data-id="${escapeHtml(p.id)}" class="btn-cat-del">x</button>
      </td>
    `;
    tbody.appendChild(tr);
  }
  tbody.querySelectorAll('.btn-cat-edit').forEach(b => b.addEventListener('click', onCatalogEdit));
  tbody.querySelectorAll('.btn-cat-del').forEach(b => b.addEventListener('click', onCatalogDelete));
}

function resetCatalogForm() {
  document.getElementById('cat-id').value = '';
  document.getElementById('cat-id-input').value = '';
  document.getElementById('cat-id-input').disabled = false;
  document.getElementById('cat-category').value = 'tcg';
  document.getElementById('cat-game').value = '';
  document.getElementById('cat-set').value = '';
  document.getElementById('cat-set-code').value = '';
  document.getElementById('cat-product').value = '';
  document.getElementById('cat-msrp').value = '';
  document.getElementById('cat-release').value = '';
  document.getElementById('cat-notes').value = '';
  document.getElementById('cat-submit').textContent = '+ Add Product';
  document.getElementById('cat-cancel').style.display = 'none';
}

function onCatalogEdit(e) {
  const id = e.target.dataset.id;
  const p = productById(id);
  if (!p) return;
  document.getElementById('cat-id').value = id;
  document.getElementById('cat-id-input').value = id;
  document.getElementById('cat-id-input').disabled = true;
  document.getElementById('cat-category').value = p.category || 'tcg';
  document.getElementById('cat-game').value = p.game || '';
  document.getElementById('cat-set').value = p.set || '';
  document.getElementById('cat-set-code').value = p.set_code || '';
  document.getElementById('cat-product').value = p.product_type || '';
  document.getElementById('cat-msrp').value = p.msrp != null ? p.msrp : '';
  document.getElementById('cat-release').value = p.release_date || '';
  document.getElementById('cat-notes').value = p.notes || '';
  document.getElementById('cat-submit').textContent = 'Save changes';
  document.getElementById('cat-cancel').style.display = 'inline-block';
  document.getElementById('cat-id-input').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function onCatalogDelete(e) {
  const id = e.target.dataset.id;
  const inUse = portfolio.holdings.some(h => h.catalog_id === id);
  if (inUse) {
    alert('Cannot delete: a holding references this product. Delete the holding first.');
    return;
  }
  if (!confirm(`Delete catalog entry "${id}"?\n\nShipped entries are hidden via overlay. Added entries are removed.`)) return;
  catalogOverlay.added = catalogOverlay.added.filter(p => p.id !== id);
  if (baselineCatalog.products.some(p => p.id === id)) {
    if (!catalogOverlay.deleted.includes(id)) catalogOverlay.deleted.push(id);
  }
  if (catalogOverlay.modified[id]) delete catalogOverlay.modified[id];
  saveCatalogOverlay();
  mergeCatalog();
  renderCatalogTable();
  renderCatalogOptions();
  renderTable();
}

function onCatalogSubmit(e) {
  e.preventDefault();
  const editingId = document.getElementById('cat-id').value;
  const id = document.getElementById('cat-id-input').value.trim();
  if (!id) { alert('ID required'); return; }
  if (!/^[a-z0-9-]+$/.test(id)) { alert('ID: lowercase letters, digits, dashes only'); return; }

  const product = {
    id,
    category: document.getElementById('cat-category').value,
    game: document.getElementById('cat-game').value.trim(),
    set: document.getElementById('cat-set').value.trim(),
    set_code: document.getElementById('cat-set-code').value.trim() || null,
    product_type: document.getElementById('cat-product').value.trim(),
    msrp: parseFloat(document.getElementById('cat-msrp').value) || null,
    release_date: document.getElementById('cat-release').value || null,
    notes: document.getElementById('cat-notes').value.trim() || ''
  };

  if (editingId) {
    const inBaseline = baselineCatalog.products.some(p => p.id === id);
    if (inBaseline) {
      catalogOverlay.modified[id] = product;
    } else {
      catalogOverlay.added = catalogOverlay.added.filter(p => p.id !== id);
      catalogOverlay.added.push(product);
    }
  } else {
    if (catalog.products.some(p => p.id === id)) {
      alert('ID already exists in catalog');
      return;
    }
    catalogOverlay.added.push(product);
    catalogOverlay.deleted = catalogOverlay.deleted.filter(d => d !== id);
  }

  saveCatalogOverlay();
  mergeCatalog();
  renderCatalogTable();
  renderCatalogOptions();
  renderTable();
  resetCatalogForm();
}

function onCatalogExport() {
  const clean = { products: catalog.products.map(p => {
    const { _source, ...rest } = p;
    return rest;
  }) };
  const blob = new Blob([JSON.stringify(clean, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'catalog.json';
  a.click();
  URL.revokeObjectURL(url);
}

function onCatalogReset() {
  if (!confirm('Discard all local catalog edits? Reverts to shipped catalog.json.')) return;
  catalogOverlay = { added: [], modified: {}, deleted: [] };
  saveCatalogOverlay();
  mergeCatalog();
  renderCatalogTable();
  renderCatalogOptions();
  renderTable();
}

// ---------- SVG chart ----------

function collectTimeSeries() {
  // Chart covers currently-held positions only. Sold positions live in the Closed table,
  // and once sold they don't contribute to "what's this portfolio worth today."
  const events = [];
  portfolio.holdings.forEach((h, idx) => {
    if (h.status === 'sold') return;
    const costDate = h.buy_date || h.gift_date;
    if (costDate) {
      const cost = (h.buy_price || 0) * (h.qty || 1);
      events.push({ date: costDate, type: 'acquire', holdingIdx: idx, costDelta: cost });
    }
    (h.price_checks || []).forEach(pc => {
      events.push({ date: pc.date, type: 'price', holdingIdx: idx, price: pc.price });
    });
  });
  events.sort((a,b) => a.date.localeCompare(b.date));
  return events;
}

function buildSeries() {
  const events = collectTimeSeries();
  const latestPriceByHolding = new Map(); // holdingIdx -> price
  let cumCost = 0;
  const costSeries = []; // {date, value}
  const marketSeries = []; // {date, value}

  for (const ev of events) {
    if (ev.type === 'acquire') {
      cumCost += ev.costDelta || 0;
    } else if (ev.type === 'price') {
      latestPriceByHolding.set(ev.holdingIdx, ev.price);
    }
    let market = 0;
    let haveAny = false;
    portfolio.holdings.forEach((h, idx) => {
      if (h.status === 'sold') return;
      if (latestPriceByHolding.has(idx)) {
        market += latestPriceByHolding.get(idx) * (h.qty || 1);
        haveAny = true;
      }
    });
    costSeries.push({ date: ev.date, value: cumCost });
    marketSeries.push({ date: ev.date, value: haveAny ? market : null });
  }

  // Append today's point so the current state is visible even without fresh events
  const today = new Date().toISOString().slice(0,10);
  if (costSeries.length === 0 || costSeries[costSeries.length-1].date < today) {
    let market = 0;
    let haveAny = false;
    portfolio.holdings.forEach((h, idx) => {
      if (h.status === 'sold') return;
      if (latestPriceByHolding.has(idx)) {
        market += latestPriceByHolding.get(idx) * (h.qty || 1);
        haveAny = true;
      }
    });
    costSeries.push({ date: today, value: cumCost });
    marketSeries.push({ date: today, value: haveAny ? market : null });
  }

  return { costSeries, marketSeries };
}

function renderChart() {
  const container = document.getElementById('chart-container');
  if (!container) return;
  const hasHeldWithDate = portfolio.holdings.some(h => h.status !== 'sold' && (h.buy_date || h.gift_date));
  if (!hasHeldWithDate) {
    container.innerHTML = '<p style="color:#AAAAFF;">No data yet. Add a held position with a buy/gift date to start the chart.</p>';
    return;
  }
  const { costSeries, marketSeries } = buildSeries();

  const W = 900, H = 320;
  const PAD_L = 60, PAD_R = 20, PAD_T = 20, PAD_B = 40;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  const allDates = costSeries.map(p => p.date);
  const minD = allDates[0];
  const maxD = allDates[allDates.length - 1];
  const minT = Date.parse(minD);
  const maxT = Date.parse(maxD);
  const dateSpan = Math.max(maxT - minT, 1);

  const vals = [
    ...costSeries.map(p => p.value || 0),
    ...marketSeries.filter(p => p.value != null).map(p => p.value)
  ];
  const maxV = Math.max(...vals, 10);
  const minV = 0;
  const valSpan = maxV - minV || 1;

  const xOf = d => PAD_L + ((Date.parse(d) - minT) / dateSpan) * innerW;
  const yOf = v => PAD_T + innerH - ((v - minV) / valSpan) * innerH;

  const costPath = costSeries.map((p,i) => `${i===0?'M':'L'}${xOf(p.date).toFixed(1)},${yOf(p.value).toFixed(1)}`).join(' ');

  // Market series — break on nulls
  let marketPath = '';
  let penDown = false;
  for (const p of marketSeries) {
    if (p.value == null) { penDown = false; continue; }
    const cmd = penDown ? 'L' : 'M';
    marketPath += `${cmd}${xOf(p.date).toFixed(1)},${yOf(p.value).toFixed(1)} `;
    penDown = true;
  }

  // Y-axis ticks
  const yTicks = 5;
  const yTickMarks = [];
  for (let i = 0; i <= yTicks; i++) {
    const v = minV + (valSpan * i / yTicks);
    yTickMarks.push(`
      <line x1="${PAD_L}" y1="${yOf(v).toFixed(1)}" x2="${W-PAD_R}" y2="${yOf(v).toFixed(1)}" stroke="#003366" stroke-dasharray="2,3"/>
      <text x="${PAD_L - 6}" y="${(yOf(v) + 4).toFixed(1)}" fill="#AAAAFF" font-size="10" text-anchor="end">$${v.toFixed(0)}</text>
    `);
  }

  // X-axis ticks — first, mid, last
  const xLabels = [minD];
  if (dateSpan > 30*24*3600*1000) xLabels.push(new Date((minT+maxT)/2).toISOString().slice(0,10));
  xLabels.push(maxD);
  const xTickMarks = xLabels.map(d => `
    <text x="${xOf(d).toFixed(1)}" y="${H - PAD_B + 18}" fill="#AAAAFF" font-size="10" text-anchor="middle">${d}</text>
    <line x1="${xOf(d).toFixed(1)}" y1="${PAD_T}" x2="${xOf(d).toFixed(1)}" y2="${H-PAD_B}" stroke="#003366" stroke-dasharray="2,3"/>
  `).join('');

  // Dots for market points
  const marketDots = marketSeries
    .filter(p => p.value != null)
    .map(p => `<circle cx="${xOf(p.date).toFixed(1)}" cy="${yOf(p.value).toFixed(1)}" r="3" fill="#00FF00"/>`).join('');

  const svg = `
    <svg viewBox="0 0 ${W} ${H}" width="100%" xmlns="http://www.w3.org/2000/svg" style="background:#000014; border:2px solid #003366;">
      ${yTickMarks.join('')}
      ${xTickMarks}
      <rect x="${PAD_L}" y="${PAD_T}" width="${innerW}" height="${innerH}" fill="none" stroke="#00FFFF" stroke-width="1"/>
      <path d="${costPath}" fill="none" stroke="#00FFFF" stroke-width="2" stroke-dasharray="6,4"/>
      ${marketPath ? `<path d="${marketPath.trim()}" fill="none" stroke="#00FF00" stroke-width="2"/>` : ''}
      ${marketDots}
    </svg>
    <div class="chart-legend">
      <span style="color:#00FFFF;">— — cost basis</span>
      <span style="color:#00FF00;">——— logged market value</span>
    </div>
  `;
  container.innerHTML = svg;
}

// ---------- init ----------

async function init() {
  await loadBaselineCatalog();
  loadCatalogOverlay();
  mergeCatalog();
  loadPortfolio();
  renderCatalogOptions();
  renderCatalogTable();
  renderTable();

  document.getElementById('add-form').addEventListener('submit', onAddHolding);
  document.getElementById('export-btn').addEventListener('click', onExport);
  document.getElementById('import-file').addEventListener('change', onImport);
  document.getElementById('acquisition').addEventListener('change', onAcquisitionChange);
  document.getElementById('catalog-form').addEventListener('submit', onCatalogSubmit);
  document.getElementById('cat-cancel').addEventListener('click', resetCatalogForm);
  document.getElementById('cat-export-btn').addEventListener('click', onCatalogExport);
  document.getElementById('cat-reset-btn').addEventListener('click', onCatalogReset);
  document.querySelectorAll('th[data-sort]').forEach(th => th.addEventListener('click', onSortClick));

  onAcquisitionChange();
}

init();
