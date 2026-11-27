# Agent Ready Shop

The AI-commerce toolkit for online stores: a **web analyzer**, the **WooCommerce plugin**, and the **Agent Ready certification** — a verifiable trust badge stores earn once they are legible and transactable for AI shopping agents.

Three parts, one product:

1. **Analyzer** (`/`) — enter a store URL, get a live AIO (AI Optimization) score across 6 checks (robots, llms.txt, JSON-LD, Agent Commerce API, product feed, certification).
2. **Plugin dashboard** (in-app demo of the WordPress admin) — configure the plugin and see the certificate/badge studio.
3. **Certificate & badge** — the marketing centerpiece. Passing stores mint a verifiable "Agent Ready Certified" badge to embed on their site.

## Run locally

**Prerequisites:** Node.js

```bash
npm install
npm run dev      # tsx server.ts → http://localhost:3000
```

The Express server (`server.ts`) provides the live endpoints the app needs:

| Endpoint | Purpose |
|---|---|
| `GET /api/run-audit?url=` | Live audit of a store, scoring the 6 AIO checks against the plugin's real endpoints |
| `GET /api/badge?d=&style=` | Renders the embeddable SVG trust badge with the score from the server's own last live audit (never from the URL) |
| `GET /verify?d=` | Public verification page: re-audits the domain live and reports whether it is certified |
| `GET /api/download-plugin` | Zips and serves the real plugin from `plugin/agent-ready-shop/` |

## The plugin

The real WordPress plugin lives in [`plugin/agent-ready-shop/`](plugin/agent-ready-shop). The "Download plugin" button and the analyzer's CTA both serve it from disk, so the download always matches the shipped source.

Key pieces:
- Agent Commerce API (`agent-shop/v1`), manifest, OpenAPI, llms.txt, robots.txt, JSON + Google XML feeds.
- Offline HMAC license system (`tools/generate-license.php`).
- `class-afs-certificate.php` — mints the certificate and injects the trust badge. The plugin only passes the store domain to the service; the score shown on the badge is the one the service measured.

## How the certificate works

A store is certified when **our own live audit** of it finds a working Agent Ready Shop product API and a score of 60 or more. Tiers: **Certified** (85+), **Verified** (60–84), else not certified.

- The badge (`/api/badge?d=domain`) shows the score from the server's last audit of that domain, refreshed daily. A score or tier is never read from the URL, so a badge cannot claim what the store did not earn.
- The verification page (`/verify?d=domain`) re-audits the store when it is opened.
- A manifest alone is only a claim: it counts once the product API it points to answers on the same host with product data.
- `ARS-…` IDs are a reference label derived from the domain with a public constant. They are not secret and are not part of the verification.
