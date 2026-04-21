// dlz-changelog worker — reader + writer + rss, one deploy.
// Caching via Workers Cache API (caches.default). TTL-only invalidation:
// after a commit write, the cache naturally refreshes within 60s. No KV.

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

const CACHE_TTL_SECONDS = 60;
const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;
const SITE_ORIGIN = 'https://diamondlegendz.com';
const FEED_URL    = 'https://dlz-changelog.alex-adamczyk.workers.dev/rss';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method;

    if (method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });

    try {
      if (pathname === '/health')                              return json({ ok: true });
      if (pathname === '/entries'        && method === 'GET')  return await cached(request, ctx, () => readEntries(url, env));
      if (pathname === '/entries'        && method === 'POST') return await writeEntry(request, env);
      if (pathname.startsWith('/entries/') && method === 'GET') return await cached(request, ctx, () => readOneEntry(pathname.slice('/entries/'.length), env));
      if (pathname === '/rss'            && method === 'GET')  return await cached(request, ctx, () => readRss(env));
      return json({ error: 'not found' }, 404);
    } catch (err) {
      console.log(JSON.stringify({ level: 'error', event: 'unhandled', path: pathname, method, message: String(err && err.message || err) }));
      return json({ error: 'internal error' }, 500);
    }
  },
};

// ---------- cache wrapper ----------

async function cached(request, ctx, builder) {
  const cache = caches.default;
  const hit = await cache.match(request);
  if (hit) {
    const res = new Response(hit.body, hit);
    res.headers.set('X-Cache', 'HIT');
    return res;
  }
  const fresh = await builder();
  if (fresh.status === 200) {
    const toStore = fresh.clone();
    toStore.headers.set('Cache-Control', `public, max-age=${CACHE_TTL_SECONDS}`);
    ctx.waitUntil(cache.put(request, toStore));
  }
  const res = new Response(fresh.body, fresh);
  res.headers.set('X-Cache', 'MISS');
  return res;
}

// ---------- reader ----------

async function readEntries(url, env) {
  const limit  = clampInt(url.searchParams.get('limit'),  DEFAULT_LIMIT, 1, MAX_LIMIT);
  const offset = clampInt(url.searchParams.get('offset'), 0,             0, Number.MAX_SAFE_INTEGER);

  const [listRes, countRes] = await Promise.all([
    env.DB.prepare(
      `SELECT id, commit_hash, commit_date, created_at, author_name, author_email,
              prefix_hint, subject, body, tech_detail
         FROM changelog_entries
        ORDER BY id DESC
        LIMIT ? OFFSET ?`
    ).bind(limit, offset).all(),
    env.DB.prepare(`SELECT COUNT(*) AS total FROM changelog_entries`).first(),
  ]);

  const total = (countRes && countRes.total) || 0;
  const rows  = listRes.results || [];
  return json({
    success: true,
    data: rows,
    pagination: { limit, offset, total, hasMore: offset + rows.length < total },
  });
}

async function readOneEntry(hash, env) {
  if (!/^[a-f0-9]{7,40}$/i.test(hash)) return json({ error: 'bad hash' }, 400);
  const row = await env.DB.prepare(
    `SELECT id, commit_hash, commit_date, created_at, author_name, author_email,
            prefix_hint, subject, body, tech_detail
       FROM changelog_entries
      WHERE commit_hash LIKE ?
      LIMIT 1`
  ).bind(`${hash}%`).first();
  if (!row) return json({ error: 'not found' }, 404);
  return json({ success: true, data: row });
}

// ---------- rss ----------

async function readRss(env) {
  const { results } = await env.DB.prepare(
    `SELECT commit_hash, commit_date, author_name, subject, body, tech_detail
       FROM changelog_entries
      ORDER BY id DESC
      LIMIT 50`
  ).all();
  const xml = buildRss(results || []);
  return new Response(xml, {
    status: 200,
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', ...CORS_HEADERS },
  });
}

function buildRss(rows) {
  const items = rows.map(row => {
    const link = `${SITE_ORIGIN}/changelog.html#${row.commit_hash}`;
    const desc = [row.body, row.tech_detail].filter(Boolean).join('\n\n');
    return `    <item>
      <title>${xmlEscape(row.subject)}</title>
      <link>${xmlEscape(link)}</link>
      <guid isPermaLink="false">${xmlEscape(row.commit_hash)}</guid>
      <pubDate>${toRfc822(row.commit_date)}</pubDate>
      <author>dev@diamondlegendz.com (${xmlEscape(row.author_name || 'unknown')})</author>
      <description><![CDATA[${desc}]]></description>
    </item>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Diamondlegendz Changelog</title>
    <link>${SITE_ORIGIN}/changelog.html</link>
    <atom:link href="${FEED_URL}" rel="self" type="application/rss+xml"/>
    <description>Commit-driven dev-ring feed for diamondlegendz.com — patch-note style.</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>`;
}

// ---------- writer ----------

async function writeEntry(request, env) {
  if (!timingSafeEqual(getBearer(request), env.WRITER_AUTH_TOKEN)) {
    return json({ error: 'unauthorized' }, 401);
  }

  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'bad json' }, 400); }

  const missing = ['commit_hash', 'commit_date', 'subject', 'raw_message'].filter(k => !body[k]);
  if (missing.length) return json({ error: `missing fields: ${missing.join(', ')}` }, 400);

  if (!/^[a-f0-9]{7,40}$/i.test(body.commit_hash)) return json({ error: 'bad commit_hash' }, 400);
  if (body.raw_message.length > 32 * 1024)         return json({ error: 'message too large' }, 413);

  try {
    await env.DB.prepare(
      `INSERT INTO changelog_entries
         (commit_hash, commit_date, author_name, author_email, prefix_hint, subject, body, tech_detail, raw_message)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      body.commit_hash,
      body.commit_date,
      body.author_name || null,
      body.author_email || null,
      body.prefix_hint || null,
      body.subject,
      body.body || null,
      body.tech_detail || null,
      body.raw_message
    ).run();
  } catch (err) {
    const msg = String(err && err.message || err);
    if (msg.includes('UNIQUE') || msg.includes('2067')) {
      return json({ ok: true, duplicate: true }, 200);
    }
    console.log(JSON.stringify({ level: 'error', event: 'write_failed', hash: body.commit_hash, message: msg }));
    return json({ error: 'write failed' }, 500);
  }

  return json({ ok: true, commit_hash: body.commit_hash }, 201);
}

// ---------- helpers ----------

function json(obj, status = 200, extra = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS, ...extra },
  });
}

function clampInt(raw, fallback, min, max) {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function getBearer(request) {
  const h = request.headers.get('Authorization') || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : '';
}

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function xmlEscape(s) {
  return String(s).replace(/[<>&'"]/g, c => ({ '<':'&lt;', '>':'&gt;', '&':'&amp;', "'":'&apos;', '"':'&quot;' }[c]));
}

function toRfc822(iso) {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? new Date().toUTCString() : d.toUTCString();
}
