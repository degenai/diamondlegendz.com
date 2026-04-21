#!/usr/bin/env node
// scripts/update-changelog.js — push new commits into dlz-changelog worker.
//
// Usage:
//   node scripts/update-changelog.js --dry-run
//   node scripts/update-changelog.js --backfill --dry-run
//   node scripts/update-changelog.js                # CI default: push delta since last known hash
//
// Env:
//   CHANGELOG_URL        — base URL of the worker (e.g. https://dlz-changelog.alex-adamczyk.workers.dev)
//   WRITER_AUTH_TOKEN    — shared secret, matches worker's WRITER_AUTH_TOKEN
//
// Safety: always supports --dry-run. Exits non-zero only on hard errors; noisy warnings
// never fail CI. See feedback_ci_dry_run_first.md — rehearse locally before wiring CI.

import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const THIS_FILE = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(THIS_FILE), '..');

const PREFIX_TAGS = ['feat', 'fix', 'chore', 'refactor', 'docs', 'test', 'style', 'perf', 'build', 'ci', 'revert'];
const PREFIX_RE   = new RegExp(`^(${PREFIX_TAGS.join('|')})(\\([^)]*\\))?:\\s*`, 'i');
const BOT_AUTHORS = [/\[bot\]/i, /dependabot/i, /github-actions/i, /renovate/i];

const args = parseArgs(process.argv.slice(2));

(async function main() {
  const baseUrl   = process.env.CHANGELOG_URL || args['writer-url'];
  const authToken = process.env.WRITER_AUTH_TOKEN;
  const dryRun    = Boolean(args['dry-run']);
  const backfill  = Boolean(args.backfill);
  const sinceArg  = args.since || null;
  const limit     = args.limit ? parseInt(args.limit, 10) : null;
  const verbose   = Boolean(args.verbose);

  if (!dryRun && !baseUrl)   die('CHANGELOG_URL env var required when not --dry-run');
  if (!dryRun && !authToken) die('WRITER_AUTH_TOKEN env var required when not --dry-run');

  const sinceHash = sinceArg || (backfill ? null : (dryRun ? null : await fetchLatestHash(baseUrl, verbose)));
  const range = sinceHash ? `${sinceHash}..HEAD` : '';
  log(`range: ${range || '(full main-branch history)'}`);

  const commits = readCommits(range);
  log(`total candidate commits: ${commits.length}`);

  const entries = commits
    .map(parseCommit)
    .filter(e => e && !isNoise(e))
    .filter(e => isEntryWorthy(e));

  log(`entry-worthy after filter: ${entries.length}`);

  const toSend = limit ? entries.slice(0, limit) : entries;

  if (dryRun) {
    for (const e of toSend) {
      console.log('-'.repeat(60));
      console.log(`hash:    ${e.commit_hash.slice(0, 10)}`);
      console.log(`date:    ${e.commit_date}`);
      console.log(`author:  ${e.author_name} <${e.author_email}>`);
      console.log(`prefix:  ${e.prefix_hint || '(none)'}`);
      console.log(`subject: ${e.subject}`);
      if (e.body)        console.log(`\nbody:\n${indent(e.body)}`);
      if (e.tech_detail) console.log(`\ntech:\n${indent(e.tech_detail)}`);
    }
    console.log('-'.repeat(60));
    console.log(`[dry-run] would push ${toSend.length} entries. no HTTP calls made.`);
    return;
  }

  // Push oldest → newest so id-order matches commit-order (newest ends up with
  // the highest id, and the reader's ORDER BY id DESC puts it at the top of the feed).
  // toSend is already oldest-first thanks to `git log --reverse`.
  let pushed = 0, skipped = 0, failed = 0;
  for (const e of toSend) {
    const res = await postEntry(baseUrl, authToken, e);
    if (res.status === 'created')   pushed++;
    else if (res.status === 'duplicate') skipped++;
    else { failed++; console.warn(`[warn] push failed ${e.commit_hash.slice(0,10)}: ${res.detail}`); }
    if (verbose) console.log(`  ${e.commit_hash.slice(0,10)} ${res.status}`);
  }
  console.log(`pushed=${pushed} skipped=${skipped} failed=${failed}`);
  if (failed > 0 && failed === toSend.length) process.exit(1);
})().catch(err => {
  console.error(err && err.stack || err);
  process.exit(1);
});

// ---------- commit parsing ----------

function readCommits(range) {
  const fmt = ['%H', '%aI', '%an', '%ae', '%P', '%B'].join('%x1f') + '%x1e';
  const gitArgs = ['log', '--no-merges', '--reverse', `--format=${fmt}`];
  if (range) gitArgs.push(range);
  gitArgs.push('--', '.');

  let raw;
  try {
    raw = execFileSync('git', gitArgs, { cwd: REPO_ROOT, maxBuffer: 32 * 1024 * 1024 }).toString('utf8');
  } catch (err) {
    die(`git log failed: ${err.message}`);
  }

  return raw.split('\x1e').map(s => s.trim()).filter(Boolean).map(rec => {
    const [hash, date, author, email, parents, ...rest] = rec.split('\x1f');
    return { hash, date, author, email, parents, raw_message: rest.join('\x1f').trim() };
  });
}

function parseCommit(rec) {
  if (!rec || !rec.raw_message) return null;

  const lines = rec.raw_message.split('\n');
  const firstLine = lines[0] || '';
  const prefixMatch = firstLine.match(PREFIX_RE);
  const prefix_hint = prefixMatch ? prefixMatch[1].toLowerCase() : null;
  const subject = prefixMatch ? firstLine.slice(prefixMatch[0].length).trim() : firstLine.trim();

  // Rest of message after the subject line.
  const rest = lines.slice(1).join('\n').replace(/^\n+/, '').replace(/\n+$/, '');

  // Split body vs tech_detail on the FIRST blank line (double newline).
  let body = null, tech_detail = null;
  if (rest) {
    const idx = rest.search(/\n\s*\n/);
    if (idx >= 0) {
      body        = rest.slice(0, idx).trim() || null;
      tech_detail = rest.slice(idx).replace(/^\s+/, '').trim() || null;
    } else {
      body = rest.trim() || null;
    }
  }

  return {
    commit_hash:  rec.hash,
    commit_date:  rec.date,
    author_name:  rec.author,
    author_email: rec.email,
    prefix_hint,
    subject,
    body,
    tech_detail,
    raw_message:  rec.raw_message,
  };
}

// ---------- filters ----------

function isNoise(e) {
  if (!e.subject) return true;
  if (/^\[skip ci\]|\[ci skip\]/i.test(e.subject)) return true;
  if (BOT_AUTHORS.some(rx => rx.test(e.author_name || '') || rx.test(e.author_email || ''))) return true;
  return false;
}

function isEntryWorthy(e) {
  // With synthesis: prefix means the author intended it as feed-worthy.
  // Without prefix, require a body so trivial one-liners stay quiet.
  if (e.prefix_hint) return true;
  if (e.body && e.body.length > 0) return true;
  return false;
}

// ---------- network ----------

async function fetchLatestHash(baseUrl, verbose) {
  try {
    const res = await fetch(`${baseUrl}/entries?limit=1&offset=0`, { method: 'GET' });
    if (!res.ok) {
      if (verbose) console.warn(`[warn] reader returned ${res.status}, falling back to full history`);
      return null;
    }
    const data = await res.json();
    const row = data && data.data && data.data[0];
    return row ? row.commit_hash : null;
  } catch (err) {
    if (verbose) console.warn(`[warn] reader fetch failed: ${err.message}`);
    return null;
  }
}

async function postEntry(baseUrl, token, entry) {
  const res = await fetch(`${baseUrl}/entries`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(entry),
  });
  let data = null;
  try { data = await res.json(); } catch {}
  if (res.status === 201) return { status: 'created' };
  if (res.status === 200 && data && data.duplicate) return { status: 'duplicate' };
  return { status: 'failed', detail: `${res.status} ${data ? JSON.stringify(data) : ''}` };
}

// ---------- tiny utils ----------

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i];
    if (!tok.startsWith('--')) continue;
    const key = tok.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) { out[key] = next; i++; }
    else out[key] = true;
  }
  return out;
}

function log(msg) { console.log(`[update-changelog] ${msg}`); }
function die(msg) { console.error(`[update-changelog] ${msg}`); process.exit(1); }
function indent(s) { return s.split('\n').map(l => '  ' + l).join('\n'); }
