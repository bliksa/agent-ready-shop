# Deploying the Agent Ready Shop website

## First, the one thing that matters

This site is **not a static website** and **not a PHP/WordPress app**. It is a
**Node.js application**: an Express server (`server.ts`) that powers the live
analyzer (`/api/run-audit`), the badge, the verifier, license issuing and the
plugin download. The React frontend is served *by that same Node server*.

So:

- ❌ You **cannot** just FTP files into `public_html` on classic shared hosting.
- ❌ Plain cPanel / "PHP hosting" without a Node runtime will **not** run it.
- ✅ You need a host that runs **Node.js 18+** as a long-running process.

(The **WordPress plugin** is separate — that goes on a WordPress site or
WordPress.org, see `RELEASE.md`. This doc is only about the website.)

## Build & run commands (any host)

```bash
npm ci            # install
npm run build     # → dist/ (frontend) + dist/server.cjs (bundled server)
npm start         # = node dist/server.cjs  (serves the whole app on $PORT)
```

Environment variables:

| Var | When | Value |
|---|---|---|
| `NODE_ENV` | always | `production` |
| `BASE_PATH` | only when hosted in a subdirectory | e.g. `/ashop` (build **and** run) |
| `PORT` | if the host sets it | host-provided, else 3000 |
| `ARS_ADMIN_TOKEN` | if you use the license generator (`/#generator`) | a long random secret |
| `ARS_LICENSE_JWK` | only if you issue Pro licenses from this server | the JSON from `secrets/ars-license.json` → `jwk` field |

> `secrets/` is git-ignored and **not** shipped. In production, pass the key as
> `ARS_LICENSE_JWK` instead of uploading the file.

---

## Serving from a subdirectory (e.g. `example.com/ashop`)

Set `BASE_PATH` at **both build time and run time** — it mounts the frontend,
the API, `/verify` and the plugin download under that prefix:

```bash
BASE_PATH=/ashop npm run build
BASE_PATH=/ashop NODE_ENV=production npm start   # → http://localhost:3000/ashop/
```

The site that owns the domain (e.g. an existing WordPress on nginx/Apache) then
only needs to forward that one prefix to the Node process, path unchanged:

```nginx
location /ashop/ { proxy_pass http://127.0.0.1:3000; proxy_set_header Host $host; proxy_set_header X-Forwarded-Proto $scheme; }
location = /ashop { return 301 /ashop/; }
```

Badges and update checks emitted by the plugin point at `AFS_VERIFY_BASE` /
`AFS_UPDATE_URL` in `plugin/agent-ready-shop/agent-ready-shop.php`; change those
if the subdirectory install is the production service.

---

## Path A — Managed Node host (easiest, recommended)

**Render / Railway / Fly.io / DigitalOcean App Platform.** These run a Node
process persistently (needed — audits are long-lived HTTP calls, so serverless
platforms with short timeouts are a poor fit).

**Render (example):**
1. Push this repo to GitHub/GitLab.
2. Render → **New → Web Service** → connect the repo.
3. Environment: **Node**. Build command: `npm ci && npm run build`. Start
   command: `npm start`. Instance: any (512 MB is plenty).
4. Add env vars from the table above.
5. Deploy. Render gives you `https://<app>.onrender.com`; add your custom domain
   in **Settings → Custom Domains** and point DNS (CNAME) as instructed.

Railway/Fly/DO App Platform are the same three fields (build, start, env).

## Path B — Your own VPS (DigitalOcean, Hetzner, Contabo…)

Full control. Ubuntu example:

```bash
# 1. Node + pm2
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs nginx
sudo npm i -g pm2

# 2. App
git clone <your-repo> /var/www/ars && cd /var/www/ars
npm ci && npm run build
NODE_ENV=production pm2 start dist/server.cjs --name ars
pm2 save && pm2 startup     # keep it running on reboot

# 3. nginx reverse proxy → the Node process on :3000
sudo tee /etc/nginx/sites-available/ars >/dev/null <<'NGINX'
server {
  server_name agentreadyshop.com www.agentreadyshop.com;
  location / { proxy_pass http://127.0.0.1:3000; proxy_set_header Host $host; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; }
}
NGINX
sudo ln -s /etc/nginx/sites-available/ars /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# 4. Free HTTPS
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d agentreadyshop.com -d www.agentreadyshop.com
```

## Path C — Docker (any container host / Coolify / CapRover / a VPS)

A `Dockerfile` is included:

```bash
docker build -t agent-ready-shop .
docker run -d -p 3000:3000 -e NODE_ENV=production \
  -e ARS_ADMIN_TOKEN=change-me agent-ready-shop
```

Put nginx/Caddy or the platform's built-in proxy in front for HTTPS.

## Path D — Shared hosting *with* a Node app manager

Some hosts (A2, Namecheap, some cPanel installs) have **"Setup Node.js App"**.
If yours does:
1. Create a Node app, Node 18+, application root = the uploaded project folder.
2. Run `npm ci && npm run build` from the host's terminal (or npm install UI).
3. Set the **startup file** to `dist/server.cjs`, `NODE_ENV=production`.
4. Add env vars; restart the app.

If your shared host has **no Node option**, it won't run this site — use Path A.

---

## After it's live

1. Point your domain's DNS to the host (A record for a VPS IP, CNAME for a PaaS).
2. Confirm HTTPS works.
3. In the **plugin**, set it to talk to your live domain — edit
   `plugin/agent-ready-shop/agent-ready-shop.php`:
   ```php
   define( 'AFS_VERIFY_BASE', 'https://agentreadyshop.com' );
   define( 'AFS_UPDATE_URL',  'https://agentreadyshop.com/api/update/agent-ready-shop.json' );
   ```
4. Smoke test: open `https://yourdomain/` → run an audit; hit
   `https://yourdomain/api/badge?d=demo.com&s=90` → should return an SVG.
