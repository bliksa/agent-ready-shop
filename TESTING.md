# Testing Agent Ready Shop on a real WooCommerce store

Nothing in this repo was executed against live WordPress/PHP during development
(the build box had Node only). Run this before any launch.

## 1. Syntax lint (no PHP needed)

```bash
node test/php-lint.mjs      # parses every plugin PHP file, reports syntax errors
```

## 2. Full stack with Docker (recommended)

Requires Docker Desktop.

```bash
docker compose up -d                 # WordPress + MariaDB
docker compose run --rm wpcli        # installs WooCommerce, activates the plugin, seeds a product
```

Then:

- Storefront / admin: http://localhost:8080/wp-admin  (**admin / admin**) → **Agent Shop**
- Endpoints:
  - http://localhost:8080/llms.txt
  - http://localhost:8080/.well-known/agent-shop.json
  - http://localhost:8080/wp-json/agent-shop/v1/products
  - http://localhost:8080/wp-json/agent-shop/v1/openapi.json

Smoke test them:

```bash
BASE=http://localhost:8080 bash test/smoke.sh
```

## 3. Manual checklist

- [ ] Plugin activates with no PHP notices (WP_DEBUG on).
- [ ] `Agent Shop` admin page renders: AIO score, AI traffic, health checks, endpoints, settings, license.
- [ ] Settings toggles persist after save (JSON-LD, XML feed, rate limit, agents…).
- [ ] `/llms.txt` and `/.well-known/agent-shop.json` return 200 (permalinks must be non-default).
- [ ] Product page `<head>` contains one Product JSON-LD block (no duplicate with SEO plugin).
- [ ] Enter a Pro key (generate: `php plugin/agent-ready-shop/tools/generate-license.php --plan=pro --expires=never --features='*'`).
  - [ ] Certificate section appears with a verifiable badge + embed code.
  - [ ] Footer badge renders on the storefront.
  - [ ] `POST /wp-json/agent-shop/v1/checkout` with `{items:[{sku:"WIDGET-1"}]}` creates a pending order + returns `pay_url`.
  - [ ] Without a key, the same call returns `402` with a readable message.
- [ ] Rate limiter: hammer `/wp-json/agent-shop/v1/products` past the discovery budget → `429` with `Retry-After`, `X-RateLimit-*`, and `scope`. Checkout with a session/Authorization header is never blocked.
- [ ] Object cache: with Redis/Memcached present, no "degraded mode" admin notice; without it, the notice appears.

## 4. Certificate integrity

The web verifier (`/verify/:id`) re-audits the live domain and only shows
"valid" when the plugin is actually detected. Confirm a domain **without** the
plugin shows "Not verified", and your Docker store (once the manifest is
reachable publicly, e.g. via a tunnel) shows "Valid — verified live".
