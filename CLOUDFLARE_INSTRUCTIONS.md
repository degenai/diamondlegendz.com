# Cloudflare Deployment Configuration

This project is configured to deploy as a Cloudflare Worker with static assets.

## Configuration

The build configuration is defined in `wrangler.jsonc`:

```jsonc
{
  "name": "diamondlegendz",
  "compatibility_date": "2024-04-01",
  "assets": {
    "directory": "."
  }
}
```

This configuration instructs Cloudflare to serve the root directory (`.`) as static assets without requiring a separate Worker script.

## Deployment

To deploy manually or via CI/CD, use:

```bash
npx wrangler versions upload
```

This command will bundle the assets and upload them to Cloudflare.

## Troubleshooting

If you encounter `[ERROR] Missing entry-point to Worker script or to assets directory`, ensure that:
1. `wrangler.jsonc` exists in the root directory.
2. The `assets` key is correctly configured with `"directory": "."`.
3. You are not using an outdated `wrangler.toml` file (it should be removed).

---

## Changelog Worker (`dlz-changelog`)

A separate Worker powers `/changelog.html` (Dev Ring). Lives in `workers/changelog/`.

### One-time provisioning

Run these from repo root:

```bash
# 1. Create the D1 database, paste database_id into workers/changelog/wrangler.toml
cd workers/changelog
wrangler d1 create dlz-changelog

# 2. Apply the schema to the remote D1 database
wrangler d1 migrations apply dlz-changelog --remote

# 3. Generate a long random secret (e.g. `openssl rand -hex 32`) and set it as a Worker secret
wrangler secret put WRITER_AUTH_TOKEN
# Paste the secret when prompted.

# 4. Deploy the Worker
wrangler deploy
# Note the public URL it prints — something like https://dlz-changelog.<subdomain>.workers.dev
```

Caching is handled by the Workers Cache API (`caches.default`) — no KV namespace to
provision, no extra binding. Cached responses expire via 60s TTL.

### GitHub Actions secrets

Add to the repo's Actions secrets (Settings → Secrets and variables → Actions):

- `CHANGELOG_URL` — the Worker URL from step 4 above
- `CHANGELOG_WRITER_TOKEN` — same value you set in step 3

### Backfill historical commits

After the Worker is live:

```bash
# From repo root. Rehearse first.
node scripts/update-changelog.js --backfill --dry-run

# Looks good? Do it for real.
CHANGELOG_URL=https://dlz-changelog.<your-subdomain>.workers.dev \
WRITER_AUTH_TOKEN=<the-secret> \
node scripts/update-changelog.js --backfill
```

From here, every push to `main` runs `.github/workflows/changelog.yml` which only sends the delta since the last known commit.

### Updating the Worker

Edits to `workers/changelog/src/index.js` need a `wrangler deploy` from `workers/changelog/`. Edits to `scripts/update-changelog.js` or `.github/workflows/changelog.yml` take effect on next push — no deploy needed.
