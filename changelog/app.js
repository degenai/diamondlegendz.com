// /changelog.html reader UI. Talks to dlz-changelog worker.
const WORKER = 'https://dlz-changelog.alex-adamczyk.workers.dev';
const PAGE_SIZE = 20;
const FEATURED_AUTHORS = { degenai: 'DEGENAI', andres404: 'ANDRES404' };

const state = { offset: 0, total: null, loading: false, seen: new Set() };

const $entries = document.getElementById('entries');
const $status  = document.getElementById('status');
const $more    = document.getElementById('load-more');

$more.addEventListener('click', () => loadPage());

(async function init() {
    await loadPage();
    const hashTarget = location.hash && location.hash.slice(1);
    if (hashTarget && /^[a-f0-9]{7,40}$/i.test(hashTarget)) await focusHash(hashTarget);
    window.addEventListener('hashchange', () => {
        const t = location.hash && location.hash.slice(1);
        if (t && /^[a-f0-9]{7,40}$/i.test(t)) focusHash(t);
    });
})();

async function loadPage() {
    if (state.loading) return;
    state.loading = true;
    $more.disabled = true;
    $status.textContent = 'loading…';

    try {
        const res = await fetch(`${WORKER}/entries?limit=${PAGE_SIZE}&offset=${state.offset}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`worker ${res.status}`);
        const payload = await res.json();
        const rows = (payload.data || []);
        state.total = payload.pagination && payload.pagination.total;
        state.offset += rows.length;

        if (state.offset === rows.length && rows.length === 0) {
            $status.innerHTML = '<div class="empty">No commits yet. Push something.</div>';
            return;
        }

        for (const row of rows) appendEntry(row);
        $status.textContent = '';
        const more = payload.pagination && payload.pagination.hasMore;
        $more.style.display = more ? '' : 'none';
    } catch (err) {
        $status.innerHTML = `<div class="error-box">could not load changelog: ${escapeText(err.message)}</div>`;
    } finally {
        state.loading = false;
        $more.disabled = false;
    }
}

async function focusHash(hash) {
    let el = document.getElementById(`e-${hash}`);
    if (!el) {
        try {
            const res = await fetch(`${WORKER}/entries/${encodeURIComponent(hash)}`, { cache: 'no-store' });
            if (res.ok) {
                const payload = await res.json();
                if (payload.data) {
                    const div = appendEntry(payload.data, { prepend: true });
                    el = div;
                }
            }
        } catch {}
    }
    if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        const tech = el.querySelector('.entry-tech');
        const toggle = el.querySelector('.tech-toggle');
        if (tech && toggle && tech.hidden) { tech.hidden = false; toggle.textContent = 'hide tech detail'; }
    }
}

function appendEntry(row, opts = {}) {
    if (state.seen.has(row.commit_hash)) return document.getElementById(`e-${row.commit_hash}`);
    state.seen.add(row.commit_hash);

    const div = document.createElement('div');
    div.className = 'entry';
    div.id = `e-${row.commit_hash}`;

    const head = document.createElement('div');
    head.className = 'entry-head';

    if (row.prefix_hint) {
        const badge = document.createElement('span');
        badge.className = `badge badge-prefix-${row.prefix_hint}`;
        badge.textContent = row.prefix_hint;
        head.appendChild(badge);
    }

    const subject = document.createElement('span');
    subject.className = 'entry-subject';
    subject.textContent = row.subject;
    head.appendChild(subject);

    const authorKey = ghHandleOf(row);
    if (authorKey && FEATURED_AUTHORS[authorKey]) {
        const ab = document.createElement('span');
        ab.className = 'badge badge-author';
        ab.textContent = FEATURED_AUTHORS[authorKey];
        head.appendChild(ab);
    }

    const date = document.createElement('span');
    date.className = 'entry-date';
    date.textContent = formatDate(row.commit_date);
    head.appendChild(date);

    const perm = document.createElement('a');
    perm.className = 'permalink';
    perm.href = `#${row.commit_hash}`;
    perm.textContent = row.commit_hash.slice(0, 7);
    perm.title = 'permalink';
    head.appendChild(perm);

    div.appendChild(head);

    if (row.body) {
        const body = document.createElement('div');
        body.className = 'entry-body';
        body.textContent = row.body;
        div.appendChild(body);
    }

    if (row.tech_detail) {
        const toggle = document.createElement('button');
        toggle.className = 'tech-toggle';
        toggle.textContent = 'show tech detail';
        const tech = document.createElement('pre');
        tech.className = 'entry-tech';
        tech.hidden = true;
        tech.textContent = row.tech_detail;
        toggle.addEventListener('click', () => {
            tech.hidden = !tech.hidden;
            toggle.textContent = tech.hidden ? 'show tech detail' : 'hide tech detail';
        });
        div.appendChild(toggle);
        div.appendChild(tech);
    }

    if (opts.prepend) $entries.prepend(div);
    else $entries.appendChild(div);
    return div;
}

function ghHandleOf(row) {
    const email = (row.author_email || '').toLowerCase();
    const m = email.match(/^(?:\d+\+)?([a-z0-9-]+)@users\.noreply\.github\.com$/);
    if (m) return m[1];
    return (row.author_name || '').toLowerCase();
}

function formatDate(iso) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso || '';
    return d.toISOString().slice(0, 10);
}

function escapeText(s) { return String(s).replace(/[<>&]/g, c => ({ '<':'&lt;', '>':'&gt;', '&':'&amp;' }[c])); }
