# Cloudflare Deployment Configuration

This project is configured to deploy as a Cloudflare Worker with static assets.

## Configuration

The build configuration is defined in `wrangler.json`:

```json
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
1. `wrangler.json` exists in the root directory.
2. The `assets` key is correctly configured with `"directory": "."`.
3. You are not using an outdated `wrangler.toml` file (it should be removed).
