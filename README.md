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
| `GET /api/badge?d=&s=&style=` | Renders the embeddable SVG trust badge |
| `GET /verify/:id?d=&s=` | Public certificate verification page (re-derives the cert from the domain) |
| `GET /api/download-plugin` | Zips and serves the real plugin from `plugin/agent-ready-shop/` |

## The plugin

The real WordPress plugin lives in [`plugin/agent-ready-shop/`](plugin/agent-ready-shop). The "Download plugin" button and the analyzer's CTA both serve it from disk, so the download always matches the shipped source.

Key pieces:
- Agent Commerce API (`agent-shop/v1`), manifest, OpenAPI, llms.txt, robots.txt, JSON + Google XML feeds.
- Offline HMAC license system (`tools/generate-license.php`).
- `class-afs-certificate.php` — mints the certificate and injects the trust badge. **The certificate ID is derived with the exact same algorithm as [`src/utils/badge.ts`](src/utils/badge.ts)**, so a badge emitted by the plugin verifies against this web service without a shared database.

## How the certificate works

`certId = ARS-{base36(hash(domain))}-{base36(hash(secret+domain))}`

Because it is deterministic and domain-bound, `/verify` can confirm a badge is genuine by recomputing the ID from the claimed domain — tamper-evident, no database. Tiers: **Certified** (85+), **Verified** (60–84), else not certified.
