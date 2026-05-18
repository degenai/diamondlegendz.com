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

  const { pos, cx, cy } = computeLayout(conn.nodes, conn.edges, width, height);

  // Edges group first (so nodes render on top).
  const edgesG = el('g', { class: 'constellation-edges' });
  conn.edges.forEach((e, idx) => {
    const from = pos.get(e.from);
    const to = pos.get(e.to);
    if (!from || !to) return;
    const color = EDGE_COLOR[e.kind] || '#888';
    const style = EDGE_STYLE[e.kind] || 'solid';
    const path = el('path', {
      class: `edge edge-${e.kind}`,
      d: edgePath(from, to, cx, cy),
      stroke: color,
      'stroke-width': 1.8,
      'stroke-opacity': 0.6,
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
      tabindex: 0,
    });
    const r = NODE_R[n.type] || 10;
    const fill = NODE_FILL[n.type] || '#999';
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

  bindInteractions(svg, tip);
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

function bindInteractions(svg, tip) {
  const root = svg.parentElement;

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
