=== Agent Ready Shop — AI Agent Optimization & Certification for WordPress ===
Contributors: agentreadyshop
Tags: ai, agents, woocommerce, llms-txt, structured-data
Requires at least: 6.0
Tested up to: 6.6
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Make any WordPress store readable and buyable by AI shopping agents (ChatGPT, Claude, Gemini, Perplexity) — and prove it with a verifiable certificate.

== Description ==

Shoppers are moving from search boxes to AI agents. Agents don't browse your theme — they read machine-readable surfaces and transact through APIs. **Agent Ready Shop** is a WordPress plugin that exposes exactly those surfaces so AI agents can find, understand, and (on Pro) buy from your store.

The site-level layer (llms.txt, robots.txt AI rules, JSON-LD passthrough, AI analytics, verified-bot detection, rate limiting and the certificate) works on **any WordPress site**. Commerce features (product feed, agentic checkout) integrate deeply with **WooCommerce** and degrade gracefully with other WordPress e-commerce plugins.

**Works with:** WooCommerce (full), and the site-level layer runs alongside Easy Digital Downloads, SureCart, Ecwid for WordPress, WP eCommerce, BigCommerce for WordPress and Shopify Buy-Button embeds. Not on WordPress? The Agent Ready certification and analyzer also audit Shopify, PrestaShop, Magento, Shoptet, Wix and Squarespace stores.

**Free — get discovered**

* **llms.txt** manifest describing your store, endpoints and policies.
* **Product JSON-LD** (Schema.org Product/Offer) on every product page, with an option to suppress duplicate schema from SEO plugins.
* **Read-only Agent Commerce API** at `/wp-json/agent-shop/v1/` — normalized products, categories, a machine-readable manifest at `/.well-known/agent-shop.json`, and an OpenAPI spec for tool discovery.
* **AI-crawler rules** in robots.txt (explicit Allow for GPTBot, ClaudeBot, PerplexityBot, Google-Extended…), with an option to **block model-training crawlers while still welcoming shopping agents**.
* **AI traffic analytics** — 100% local, no account, no data sent anywhere: which agents visit, which pages they read, and which pages AI assistants cite. Includes **verified-bot / spoof detection** (confirms a claimed GPTBot really is one).
* **Agentic rate limiting** — per-agent token buckets that protect your origin without ever throttling the checkout money-path; readable 429s with Retry-After and scope.

**Pro — get bought & certified**

* **Agentic checkout** — agents price a basket and create a ready-to-pay order via REST.
* **Enriched schema** (merchant return policy + shipping) and **full Google/XML product feed**.
* **Advanced analytics + CSV export**, custom llms.txt, unlimited agents, automatic updates.
* **Agent Ready Certified** trust badge + a public, live-verified certificate — your marketing asset.

Learn more and upgrade at https://agentreadyshop.com

== Installation ==

1. Upload the `agent-ready-shop` folder to `/wp-content/plugins/`, or install via Plugins → Add New.
2. Activate it through the Plugins menu.
3. Set your permalinks to anything other than "Plain" (Settings → Permalinks) so `/llms.txt` and `/.well-known/agent-shop.json` resolve.
4. Open **Agent Shop** in the admin menu to see your AIO score, endpoints and settings.

== Frequently Asked Questions ==

= Does it require an account or send my data anywhere? =
No. Analytics and all core features run entirely on your server. See "External services" below for the few optional outbound requests.

= Does it work without WooCommerce? =
Discovery files still serve, but product data and checkout require WooCommerce.

= How does the certificate stay trustworthy? =
The public verification page re-audits your live site and only shows "valid" when the plugin is actually detected — a badge can't be faked by a store that doesn't run it.

== Screenshots ==

1. Admin dashboard — AIO score and AI traffic (verified vs spoofed, pages read, pages cited).
2. Health checks and machine-readable endpoints.
3. Settings — structured data, feed, rate limiting, training-bot blocking.
4. License panel with the verifiable Agent Ready certificate and embed code.
5. The embeddable trust badge.

== External services ==

This plugin can make outbound requests to these services. All are optional and disclosed for transparency:

* **agentreadyshop.com** — When a Pro license is active and the badge is enabled, the storefront badge image is loaded from `agentreadyshop.com/api/badge` and links to `agentreadyshop.com/verify/...`. The Pro auto-updater checks `agentreadyshop.com/api/update/agent-ready-shop.json` for new versions. Data sent: your site domain and AIO score (for the badge), plugin version (for updates). Terms: https://agentreadyshop.com/terms — Privacy: https://agentreadyshop.com/privacy
* **AI operator IP-range lists** — For verified-bot / spoof detection, the plugin fetches the public IP-range files that AI operators publish (e.g. openai.com, developers.google.com, bing.com, perplexity.ai) and caches them for 24h. Only the operator's own published list is requested; no visitor data is sent. This confirms that a request claiming to be a given bot really originates from that operator.

You can disable analytics (and thus the range lookups) and the badge in the plugin settings.

== Changelog ==

= 1.0.0 =
* Initial release: llms.txt, Product JSON-LD, Agent Commerce API + OpenAPI, product feeds, robots.txt AI rules, training-bot blocking, local AI analytics with verified-bot detection, agentic rate limiting, agentic checkout (Pro), enriched schema (Pro), Agent Ready certificate + trust badge (Pro).

== Upgrade Notice ==

= 1.0.0 =
Initial release.
