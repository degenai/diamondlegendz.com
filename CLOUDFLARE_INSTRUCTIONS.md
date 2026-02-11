# Cloudflare Pages Configuration Instructions

If the build fails or incorrectly identifies as a Worker project (e.g. `[ERROR] Missing entry-point to Worker script`), please update the Build settings in the Cloudflare Dashboard to force a static asset deployment:

1.  Log in to the Cloudflare Dashboard and navigate to **Workers & Pages**.
2.  Select your project (`diamondlegendz`).
3.  Go to **Settings > Build & deployments**.
4.  Under **Build configuration**, click **Edit**.
5.  Set **Build command** to `exit 0` (this ensures a successful "build" without running any commands).
6.  Set **Build output directory** to `.` (this tells Cloudflare to serve the root directory as static assets).
7.  Click **Save**.

These settings will override any automatic detection and force Cloudflare to serve your HTML/CSS/JS files directly.
