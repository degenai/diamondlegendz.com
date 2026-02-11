# Cloudflare Pages Configuration Instructions

If the build fails or incorrectly identifies as a Worker project (e.g. `[ERROR] Missing entry-point to Worker script`), please ensure the following:

## 1. Wrangler Configuration

This repository includes a `wrangler.json` file configured for static asset deployment. This file tells Cloudflare to serve the root directory (`.`) as static assets rather than trying to compile a Worker script.

```json
{
  "name": "diamondlegendz",
  "compatibility_date": "2024-04-01",
  "assets": {
    "directory": "."
  }
}
```

## 2. Dashboard Settings (Fallback)

If the `wrangler.json` file is ignored or the build still fails, you can force a static deployment by updating the Build settings in the Cloudflare Dashboard:

1.  Log in to the Cloudflare Dashboard and navigate to **Workers & Pages**.
2.  Select your project (`diamondlegendz`).
3.  Go to **Settings > Build & deployments**.
4.  Under **Build configuration**, click **Edit**.
5.  Set **Build command** to `exit 0` (this ensures a successful "build" without running any commands).
6.  Set **Build output directory** to `.` (this tells Cloudflare to serve the root directory as static assets).
7.  Click **Save**.

These settings will override any automatic detection and force Cloudflare to serve your HTML/CSS/JS files directly.
