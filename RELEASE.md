# Release guide — Agent Ready Shop

Two artifacts ship separately:
1. **Free plugin** → WordPress.org (SVN).
2. **Pro + license issuing + certificate/badge/update service** → your host (the Node app in this repo).

## 0. One-time: signing keys

Licenses are **Ed25519-signed** (asymmetric). The plugin ships only the public key.

- Private key lives in `secrets/ars-license.json` (git-ignored) or env `ARS_LICENSE_JWK`.
- Public key is embedded in `plugin/agent-ready-shop/includes/class-afs-license.php` (`PUBLIC_KEY`).
- **Generate your own pair before launch** and replace both. Prove parity with:
  ```
  node_modules/.bin/tsx test/license-roundtrip.mjs   # expect PASS
  ```
- The CLI generator (`tools/generate-license.php`) needs `ARS_LICENSE_SK` (base64 sodium secret key) and is **excluded from the public zip**.

## 1. Test on real WooCommerce (required)

```
node test/php-lint.mjs           # 0 syntax errors
docker compose up -d
docker compose run --rm wpcli
BASE=http://localhost:8080 bash test/smoke.sh
```
Then walk `TESTING.md` (license activation, checkout 402 gate, rate-limit 429 shape, badge, sodium license verify).

## 2. Build the distributables

```
node scripts/make-assets.mjs     # wp.org icon + banner PNGs
node scripts/build-release.mjs   # release/agent-ready-shop.<version>.zip (no tools/)
```

## 3. WordPress.org submission (free)

- First time: submit the plugin for review at https://wordpress.org/plugins/developers/add/ using the built zip.
- Slug/text-domain: `agent-ready-shop` (already consistent).
- After approval, commit to SVN:
  - `trunk/` ← plugin files (contents of the zip's `agent-ready-shop/`).
  - `assets/` ← `banner-1544x500.png`, `banner-772x250.png`, `icon-256x256.png`, `icon-128x128.png`, `screenshot-1..5.png`.
  - Tag a release: copy `trunk` → `tags/<version>`, set `Stable tag` in readme.
- **Screenshots**: capture 1–5 from the Docker store admin (see `readme.txt` captions). These are the only assets that can't be auto-generated.
- Guideline check: GPLv2, no minified/obfuscated code, external services disclosed in readme (done), no bundled private keys (tools/ excluded).

## 4. Host the Pro service (Node app)

```
npm ci && npm run build
NODE_ENV=production ARS_ADMIN_TOKEN=... ARS_LICENSE_JWK='{...}' npm start
```
Provides: `/api/badge`, `/verify/:id` (live re-audit), `/api/update/agent-ready-shop.json`, `/api/download-plugin`, `/api/license/issue` (put behind Stripe/Lemon Squeezy webhook), `/api/license/generate` (vendor, token-gated). Vendor UI: `/#generator`.

Point the plugin's `AFS_VERIFY_BASE` and `AFS_UPDATE_URL` at this host.

## 5. Pre-launch checklist

- [ ] New Ed25519 keypair generated; public key embedded; round-trip PASS.
- [ ] `php-lint` clean; Docker smoke + `TESTING.md` pass on real WooCommerce.
- [ ] `ARS_ADMIN_TOKEN` set in production (generator refuses to run without it).
- [ ] Purchase flow wired to a real payment provider before `/api/license/issue` is public.
- [ ] Legal pages live: /terms, /privacy (referenced in readme External services).
- [ ] Screenshots added to SVN /assets.
