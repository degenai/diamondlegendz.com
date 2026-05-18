// BBL bundle constellation renderer — inline SVG, no D3, no force physics.
// Cards in an inner ring (clock positions); external resonance nodes (artists,
// characters, source-tales, places, design ancestors, mechanics, events) in an
// outer ring, each positioned near the centroid angle of its connected cards.
// Edges drawn as quadratic-bezier curves through the centre, color-coded by
// edge kind. Hover or tap a node to dim the rest and highlight its edges;
// click a node to pin the tooltip with the connection note.
//
// Data lives in bundle.connections — see drone.json / tithe.json for shape.
// Hand-authored for MVP; bbl-bundler will auto-derive these later.

const NODE_R = {
  card: 18,
  artist: 11,
  character: 11,
  symbol: 11,
  place: 11,
  'source-tale': 11,
  'design-ancestor': 10,
  mechanic: 10,
  event: 12,
};

// Neon palette consistent with the lair page (Comic Sans / yellow / magenta / cyan).
const NODE_FILL = {
  card: '#FFFF00',
  artist: '#00FF66',
  character: '#00FFFF',
  symbol: '#FF00FF',
  place: '#FFAA00',
  'source-tale': '#CC66FF',
  'design-ancestor': '#FFCC00',
  mechanic: '#66CCFF',
  event: '#FF4444',
};

const EDGE_COLOR = {
  'co-previewed':         '#FF8800',
  'depicts':              '#FF00FF',
  'depicts-servant-of':   '#FF00FF',
  'depicted-in':          '#FFAA00',
  'illustrated-by':       '#00FF66',
  'designed-by':          '#00FF66',
  'flavor-speaker':       '#00FFFF',
  'source-tale':          '#CC66FF',
  'source-game':          '#CC66FF',
  'source-song':          '#CC66FF',
  'design-lineage':       '#FFCC00',
  'naming-lineage':       '#FFCC00',
  'mechanical-twin':      '#FF4466',
  'mechanic-debut':       '#66CCFF',
  'uses-mechanic':        '#66CCFF',
  'guild-watermark':      '#FF00FF',
  'biographical-irony':   '#FF66CC',
};

const EDGE_STYLE = {
  'biographical-irony': 'dashed',
};

const EDGE_KIND_LABEL = {
  'co-previewed':         'co-previewed',
  'depicts':              'depicts',
  'depicts-servant-of':   'depicts servant of',
  'depicted-in':          'depicted in',
  'illustrated-by':       'illustrated by',
  'designed-by':          'designed by',
  'flavor-speaker':       'flavor speaker',
  'source-tale':          'source tale',
  'source-game':          'source game',
  'source-song':          'source song',
  'design-lineage':       'design lineage',
  'naming-lineage':       'naming lineage',
  'mechanical-twin':      'mechanical twin',
  'mechanic-debut':       'mechanic debut',
  'uses-mechanic':        'uses mechanic',
  'guild-watermark':      'guild watermark',
  'biographical-irony':   'biographical irony',
};

const SVG_NS = 'http://www.w3.org/2000/svg';

function el(name, attrs = {}) {
  const n = document.createElementNS(SVG_NS, name);
  for (const k of Object.keys(attrs)) n.setAttribute(k, attrs[k]);
  return n;
}

// Place card nodes evenly around an inner circle starting at the top.
// External nodes go in an outer ring at the average angle of their connected
// card nodes. If an external has no connected card (unlikely but defensive),
// it gets placed at the bottom.
function computeLayout(nodes, edges, width, height) {
  const cx = width / 2;
  const cy = height / 2;
  const innerR = Math.min(width, height) * 0.26;
  const outerR = Math.min(width, height) * 0.44;

  const cards = nodes.filter(n => n.type === 'card');
  const externals = nodes.filter(n => n.type !== 'card');

  const pos = new Map();

  // Cards — clock layout, starting at top (-90°).
  cards.forEach((c, i) => {
    const angle = -Math.PI / 2 + (i / cards.length) * 2 * Math.PI;
    pos.set(c.id, { x: cx + innerR * Math.cos(angle), y: cy + innerR * Math.sin(angle), angle });
  });

  // For each external, find average angle of connected cards.
  const cardAngles = new Map();
  for (const c of cards) cardAngles.set(c.id, pos.get(c.id).angle);

  function averageAngle(angles) {
    // Average via circular mean (sum unit vectors).
    let sx = 0, sy = 0;
    for (const a of angles) { sx += Math.cos(a); sy += Math.sin(a); }
    if (sx === 0 && sy === 0) return Math.PI / 2;  // fallback: bottom
    return Math.atan2(sy, sx);
  }

  // Bin externals to angle slots so they don't overlap when many share a card.
  const externalAngles = externals.map(ext => {
    const connected = edges
      .filter(e => e.from === ext.id || e.to === ext.id)
      .map(e => (e.from === ext.id ? e.to : e.from))
      .filter(id => cardAngles.has(id))
      .map(id => cardAngles.get(id));
    return { ext, angle: connected.length ? averageAngle(connected) : Math.PI / 2 };
  });

  // Greedy spread: sort by raw angle, then nudge any that are too close to a
  // previously placed external by ~12° increments.
  externalAngles.sort((a, b) => a.angle - b.angle);
  const placedAngles = [];
  const minSep = (12 * Math.PI) / 180;
  for (const item of externalAngles) {
    let a = item.angle;
    let tries = 0;
    while (placedAngles.some(p => Math.abs(((a - p + Math.PI) % (2 * Math.PI)) - Math.PI) < minSep) && tries < 60) {
      a += minSep * (tries % 2 === 0 ? 1 : -1) * Math.ceil((tries + 1) / 2);
      tries++;
    }
    placedAngles.push(a);
    pos.set(item.ext.id, {
      x: cx + outerR * Math.cos(a),
      y: cy + outerR * Math.sin(a),
      angle: a,
    });
  }

  return { pos, cx, cy };
}

function edgePath(from, to, cx, cy) {
  // Quadratic bezier curving slightly toward the centroid so edges arc instead
  // of crossing the canvas in straight lines.
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const dx = cx - mx;
  const dy = cy - my;
  const cxC = mx + dx * 0.25;
  const cyC = my + dy * 0.25;
  return `M${from.x},${from.y} Q${cxC},${cyC} ${to.x},${to.y}`;
}

export function renderConstellation(bundle) {
  const host = document.getElementById('constellation-section');
  if (!host) return;
  const conn = bundle && bundle.connections;
  if (!conn || !Array.isArray(conn.nodes) || !Array.isArray(conn.edges) || conn.nodes.length === 0) {
    host.style.display = 'none';
    return;
  }
  host.style.display = '';
  host.replaceChildren();

  // Section label.
  const label = document.createElement('div');
  label.className = 'constellation-label';
  label.innerHTML = 'the constellation <span class="constellation-sub">curatorial connective tissue — hover a node to follow its edges</span>';
  host.appendChild(label);

  // SVG canvas. ViewBox handles mobile scaling.
  const width = 900;
  const height = 700;
  const svg = el('svg', {
    class: 'constellation-svg',
    viewBox: `0 0 ${width} ${height}`,
    xmlns: SVG_NS,
    role: 'img',
    'aria-label': 'Constellation of curatorial connections between bundle cards and external resonance nodes',
  });

  const layout = computeLayout(conn.nodes, conn.edges, width, height);
  const { pos, cx, cy } = layout;

  // Count how many bundle cards each external node connects to. Externals
  // that bridge 2+ cards are the curatorial spine (shared artist / shared
  // character / shared symbol etc.) and get visual weight: bigger node,
  // bolder label, thicker incident edges. Shared-artist in particular is
  // the strongest buyer-magnetic cohesion signal — collectors follow
  // artists.
  const cardIds = new Set(conn.nodes.filter(n => n.type === 'card').map(n => n.id));
  const bridgeCount = new Map();  // externalNodeId -> cardCount it bridges
  conn.nodes.forEach(n => bridgeCount.set(n.id, 0));
  for (const edge of conn.edges) {
    const fromIsCard = cardIds.has(edge.from);
    const toIsCard = cardIds.has(edge.to);
    if (fromIsCard && !toIsCard) bridgeCount.set(edge.to, (bridgeCount.get(edge.to) || 0) + 1);
    if (toIsCard && !fromIsCard) bridgeCount.set(edge.from, (bridgeCount.get(edge.from) || 0) + 1);
  }

  // Featured-artists callout: artists who connect to 2+ bundle cards lead the
  // list (with ×N), then singletons. Buyer-magnetic signal — surfaced at
  // a-glance before they scroll to the constellation itself.
  renderFeaturedArtistsCallout(host, conn, bridgeCount, cardIds);

  // Edges group first (so nodes render on top).
  const edgesG = el('g', { class: 'constellation-edges' });
  conn.edges.forEach((e, idx) => {
    const from = pos.get(e.from);
    const to = pos.get(e.to);
    if (!from || !to) return;
    const color = EDGE_COLOR[e.kind] || '#888';
    const style = EDGE_STYLE[e.kind] || 'solid';
    // Edges touching a multi-card bridge node (e.g. an artist who illustrated
    // 2+ cards) render thicker — the curatorial spine should be visually loud.
    const touchesBridge =
      (cardIds.has(e.from) && (bridgeCount.get(e.to) || 0) >= 2) ||
      (cardIds.has(e.to)   && (bridgeCount.get(e.from) || 0) >= 2);
    const path = el('path', {
      class: `edge edge-${e.kind}${touchesBridge ? ' edge-bridge' : ''}`,
      d: edgePath(from, to, cx, cy),
      stroke: color,
      'stroke-width': touchesBridge ? 3 : 1.8,
      'stroke-opacity': touchesBridge ? 0.85 : 0.6,
      fill: 'none',
      'data-edge-idx': idx,
      'data-from': e.from,
      'data-to': e.to,
      'data-kind': e.kind,
      'data-note': e.note || '',
    });
    if (style === 'dashed') path.setAttribute('stroke-dasharray', '6 4');
    edgesG.appendChild(path);
  });
  svg.appendChild(edgesG);

  // Nodes.
  const nodesG = el('g', { class: 'constellation-nodes' });
  conn.nodes.forEach(n => {
    const p = pos.get(n.id);
    if (!p) return;
    const g = el('g', {
      class: `node node-${n.type}${n.is_headliner ? ' is-headliner' : ''}`,
      transform: `translate(${p.x},${p.y})`,
      'data-node-id': n.id,
      'data-node-type': n.type,
      'data-node-label': n.label,
      'data-node-note': n.note || '',
      'data-orig-x': p.x,
      'data-orig-y': p.y,
      tabindex: 0,
    });
    const bridges = bridgeCount.get(n.id) || 0;
    const isBridge = n.type !== 'card' && bridges >= 2;
    const baseR = NODE_R[n.type] || 10;
    const r = isBridge ? baseR + 4 : baseR;
    const fill = NODE_FILL[n.type] || '#999';
    if (isBridge) g.classList.add('is-bridge');
    // Headliner gets a magenta ring around its card node.
    if (n.is_headliner) {
      g.appendChild(el('circle', {
        r: r + 5, fill: 'none', stroke: '#FF00FF', 'stroke-width': 2.5, 'stroke-opacity': 0.85,
      }));
    }
    g.appendChild(el('circle', {
      r, fill, stroke: '#000', 'stroke-width': 2,
    }));
    // Type-icon glyph for non-card nodes (single letter, monospace).
    if (n.type !== 'card') {
      const glyph = ({
        artist: 'A', character: 'C', symbol: 'S', place: 'P',
        'source-tale': 'T', 'design-ancestor': 'D', mechanic: 'M', event: 'E',
      })[n.type] || '?';
      g.appendChild(el('text', {
        class: 'node-glyph',
        x: 0, y: 4, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 'bold',
        fill: '#000', 'font-family': 'monospace',
      })).textContent = glyph;
    }
    // Label below the node.
    const labelOffset = r + 12;
    const t = el('text', {
      class: 'node-label',
      x: 0, y: labelOffset,
      'text-anchor': 'middle',
      'font-size': n.type === 'card' ? 10 : 9,
      fill: '#FFFFFF',
      'font-family': '"Courier New", monospace',
    });
    t.textContent = n.label.length > 28 ? n.label.slice(0, 26) + '…' : n.label;
    g.appendChild(t);
    nodesG.appendChild(g);
  });
  svg.appendChild(nodesG);

  // Legend.
  const legend = renderLegend(conn);
  host.appendChild(svg);
  host.appendChild(legend);

  // Floating tooltip element (positioned by mouse).
  const tip = document.createElement('div');
  tip.className = 'constellation-tip';
  tip.style.display = 'none';
  host.appendChild(tip);

  bindInteractions(svg, tip, { cx, cy });
}

function renderFeaturedArtistsCallout(host, conn, bridgeCount, cardIds) {
  const artistNodes = conn.nodes.filter(n => n.type === 'artist');
  if (!artistNodes.length) return;

  // Order: artists who bridge 2+ cards first (×N suffix), then singletons.
  const entries = artistNodes.map(n => ({
    label: n.label,
    count: bridgeCount.get(n.id) || 0,
  }));
  entries.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  if (!entries.length) return;
  const wrap = document.createElement('div');
  wrap.className = 'constellation-featured-artists';

  const title = document.createElement('span');
  title.className = 'featured-title';
  title.textContent = 'Featured artists:';
  wrap.appendChild(title);

  entries.forEach((e, i) => {
    const tag = document.createElement('span');
    tag.className = 'featured-artist';
    if (e.count >= 2) tag.classList.add('multi');
    tag.textContent = e.count >= 2 ? `${e.label} ×${e.count}` : e.label;
    wrap.appendChild(tag);
    if (i < entries.length - 1) {
      const sep = document.createElement('span');
      sep.className = 'featured-sep';
      sep.textContent = ' · ';
      wrap.appendChild(sep);
    }
  });
  host.appendChild(wrap);
}

function renderLegend(conn) {
  const present = new Set(conn.nodes.map(n => n.type));
  const edgeKinds = [...new Set(conn.edges.map(e => e.kind))];
  const wrap = document.createElement('div');
  wrap.className = 'constellation-legend';

  const nodeLegend = document.createElement('div');
  nodeLegend.className = 'legend-section';
  nodeLegend.innerHTML = '<span class="legend-title">nodes</span>';
  ['card','artist','character','symbol','place','source-tale','design-ancestor','mechanic','event']
    .filter(t => present.has(t))
    .forEach(t => {
      const swatch = document.createElement('span');
      swatch.className = 'legend-item';
      swatch.innerHTML =
        `<span class="legend-dot" style="background:${NODE_FILL[t]}"></span>` +
        `<span class="legend-name">${t}</span>`;
      nodeLegend.appendChild(swatch);
    });
  wrap.appendChild(nodeLegend);

  const edgeLegend = document.createElement('div');
  edgeLegend.className = 'legend-section';
  edgeLegend.innerHTML = '<span class="legend-title">edges</span>';
  edgeKinds.forEach(k => {
    const c = EDGE_COLOR[k] || '#888';
    const swatch = document.createElement('span');
    swatch.className = 'legend-item';
    swatch.innerHTML =
      `<span class="legend-line" style="background:${c}${EDGE_STYLE[k]==='dashed'?'; background-image:linear-gradient(to right, '+c+' 50%, transparent 0%); background-size:6px 2px; background-repeat:repeat-x':''}"></span>` +
      `<span class="legend-name">${EDGE_KIND_LABEL[k] || k}</span>`;
    edgeLegend.appendChild(swatch);
  });
  wrap.appendChild(edgeLegend);

  return wrap;
}

function bindInteractions(svg, tip, layout) {
  const root = svg.parentElement;

  // Current live positions per node id. Initialized from data-orig-{x,y};
  // updated during drag; spring back on release.
  const currentPos = new Map();
  svg.querySelectorAll('.node').forEach(n => {
    const id = n.getAttribute('data-node-id');
    currentPos.set(id, {
      x: parseFloat(n.getAttribute('data-orig-x')),
      y: parseFloat(n.getAttribute('data-orig-y')),
    });
  });

  // Helper: SVG userspace coords from a clientX/clientY (handles viewBox + DPI).
  function clientToSvg(clientX, clientY) {
    const pt = svg.createSVGPoint();
    pt.x = clientX; pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: clientX, y: clientY };
    const inv = ctm.inverse();
    const s = pt.matrixTransform(inv);
    return { x: s.x, y: s.y };
  }

  // Update the path of every edge incident to the given node id, using
  // currentPos for both endpoints (so edges follow the dragged node + remain
  // correct for non-dragged endpoints).
  function refreshEdgesForNode(nodeId) {
    svg.querySelectorAll('.edge').forEach(e => {
      const f = e.getAttribute('data-from');
      const t = e.getAttribute('data-to');
      if (f !== nodeId && t !== nodeId) return;
      const a = currentPos.get(f);
      const b = currentPos.get(t);
      if (!a || !b) return;
      e.setAttribute('d', edgePath(a, b, layout.cx, layout.cy));
    });
  }

  function setNodePosition(nodeEl, x, y) {
    const id = nodeEl.getAttribute('data-node-id');
    currentPos.set(id, { x, y });
    nodeEl.setAttribute('transform', `translate(${x},${y})`);
    refreshEdgesForNode(id);
  }

  function highlightForNode(nodeId) {
    svg.querySelectorAll('.node').forEach(n => {
      const id = n.getAttribute('data-node-id');
      n.classList.toggle('dim', id !== nodeId && !isAdjacent(id, nodeId));
      n.classList.toggle('focus', id === nodeId);
    });
    svg.querySelectorAll('.edge').forEach(e => {
      const f = e.getAttribute('data-from');
      const t = e.getAttribute('data-to');
      const active = f === nodeId || t === nodeId;
      e.classList.toggle('dim', !active);
      e.classList.toggle('active', active);
      e.setAttribute('stroke-opacity', active ? 0.95 : 0.12);
      e.setAttribute('stroke-width', active ? 3 : 1.4);
    });
  }

  // Drag state for the currently-dragged node.
  let drag = null;
  // After a successful drag, swallow the click event that fires on pointerup
  // so the pin/highlight logic below doesn't toggle.
  let suppressNextClick = false;

  svg.addEventListener('pointerdown', (ev) => {
    if (ev.button !== undefined && ev.button !== 0) return;
    const node = ev.target.closest('.node');
    if (!node) return;
    const id = node.getAttribute('data-node-id');
    const pt = clientToSvg(ev.clientX, ev.clientY);
    const cur = currentPos.get(id);
    drag = {
      pointerId: ev.pointerId,
      node,
      id,
      offsetX: cur.x - pt.x,
      offsetY: cur.y - pt.y,
      moved: false,
    };
    try { svg.setPointerCapture(ev.pointerId); } catch (_) {}
    node.classList.add('dragging');
    ev.preventDefault();
  });

  svg.addEventListener('pointermove', (ev) => {
    if (!drag || ev.pointerId !== drag.pointerId) return;
    const pt = clientToSvg(ev.clientX, ev.clientY);
    setNodePosition(drag.node, pt.x + drag.offsetX, pt.y + drag.offsetY);
    drag.moved = true;
  });

  function endDrag(ev) {
    if (!drag || ev.pointerId !== drag.pointerId) return;
    const node = drag.node;
    const id = drag.id;
    const moved = drag.moved;
    try { svg.releasePointerCapture(ev.pointerId); } catch (_) {}
    drag = null;
    node.classList.remove('dragging');
    if (!moved) return;  // click-without-drag falls through to the click handler
    suppressNextClick = true;

    // Spring back to the original layout position. ~480ms ease-out with a
    // gentle overshoot (cubic-out for the body, plus a small sine bump near
    // the end). All animation happens via setNodePosition so edges update too.
    const start = currentPos.get(id);
    const targetX = parseFloat(node.getAttribute('data-orig-x'));
    const targetY = parseFloat(node.getAttribute('data-orig-y'));
    const dx = targetX - start.x;
    const dy = targetY - start.y;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
    const duration = 480;
    const t0 = performance.now();
    function ease(t) {
      // ease-out cubic + 5% overshoot near the tail
      const e = 1 - Math.pow(1 - t, 3);
      const overshoot = Math.sin(t * Math.PI) * 0.05 * (t < 0.7 ? 0 : 1);
      return e + overshoot;
    }
    function step(now) {
      const t = Math.min(1, (now - t0) / duration);
      const k = ease(t);
      const x = start.x + dx * k;
      const y = start.y + dy * k;
      setNodePosition(node, x, y);
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  svg.addEventListener('pointerup', endDrag);
  svg.addEventListener('pointercancel', endDrag);

  function isAdjacent(idA, idB) {
    if (!idA || !idB) return false;
    return [...svg.querySelectorAll('.edge')].some(e => {
      const f = e.getAttribute('data-from');
      const t = e.getAttribute('data-to');
      return (f === idA && t === idB) || (f === idB && t === idA);
    });
  }

  function clearHighlight() {
    svg.querySelectorAll('.node').forEach(n => n.classList.remove('dim', 'focus'));
    svg.querySelectorAll('.edge').forEach(e => {
      e.classList.remove('dim', 'active');
      e.setAttribute('stroke-opacity', 0.6);
      e.setAttribute('stroke-width', 1.8);
    });
  }

  function showTip(html, ev) {
    tip.innerHTML = html;
    tip.style.display = 'block';
    const r = root.getBoundingClientRect();
    const x = ev.clientX - r.left;
    const y = ev.clientY - r.top;
    tip.style.left = Math.min(x + 12, r.width - 280) + 'px';
    tip.style.top = Math.max(y - 8, 0) + 'px';
  }
  function hideTip() { tip.style.display = 'none'; }

  svg.addEventListener('mouseover', ev => {
    const node = ev.target.closest('.node');
    const edge = ev.target.closest('.edge');
    if (node) {
      const id = node.getAttribute('data-node-id');
      const label = node.getAttribute('data-node-label');
      const note = node.getAttribute('data-node-note');
      highlightForNode(id);
      showTip(`<strong>${escapeHtml(label)}</strong>${note ? `<br><span class="tip-note">${escapeHtml(note)}</span>` : ''}`, ev);
    } else if (edge) {
      const kind = edge.getAttribute('data-kind');
      const note = edge.getAttribute('data-note');
      const f = svg.querySelector(`.node[data-node-id="${edge.getAttribute('data-from')}"]`);
      const t = svg.querySelector(`.node[data-node-id="${edge.getAttribute('data-to')}"]`);
      const fL = f ? f.getAttribute('data-node-label') : '';
      const tL = t ? t.getAttribute('data-node-label') : '';
      showTip(`<strong>${escapeHtml(fL)}</strong> <span class="tip-kind">${escapeHtml(EDGE_KIND_LABEL[kind] || kind)}</span> <strong>${escapeHtml(tL)}</strong>${note ? `<br><span class="tip-note">${escapeHtml(note)}</span>` : ''}`, ev);
    }
  });
  svg.addEventListener('mousemove', ev => {
    if (tip.style.display === 'block') {
      const r = root.getBoundingClientRect();
      const x = ev.clientX - r.left;
      const y = ev.clientY - r.top;
      tip.style.left = Math.min(x + 12, r.width - 280) + 'px';
      tip.style.top = Math.max(y - 8, 0) + 'px';
    }
  });
  svg.addEventListener('mouseout', ev => {
    if (!ev.relatedTarget || !svg.contains(ev.relatedTarget)) {
      clearHighlight();
      hideTip();
    }
  });

  // Touch / click: tap a node to pin highlight; tap empty area to clear.
  let pinnedId = null;
  svg.addEventListener('click', ev => {
    if (suppressNextClick) { suppressNextClick = false; return; }
    const node = ev.target.closest('.node');
    if (node) {
      const id = node.getAttribute('data-node-id');
      if (pinnedId === id) { pinnedId = null; clearHighlight(); hideTip(); }
      else { pinnedId = id; highlightForNode(id);
        const label = node.getAttribute('data-node-label');
        const note = node.getAttribute('data-node-note');
        showTip(`<strong>${escapeHtml(label)}</strong>${note ? `<br><span class="tip-note">${escapeHtml(note)}</span>` : ''}`, ev);
      }
    } else {
      pinnedId = null;
      clearHighlight();
      hideTip();
    }
  });
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
