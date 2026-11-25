# Agent Ready Shop — launch & campaign kit

## Positioning

**One line:** The trust standard for AI-agent commerce. Free gets your store
found by AI. Pro gets it bought — and certified.

**The shift:** Shoppers are moving from search boxes to AI agents (ChatGPT,
Claude, Gemini, Perplexity). Agents don't browse your theme — they read
machine surfaces and transact through APIs. Stores that aren't agent-ready get
skipped silently.

## The hook: the badge

The centerpiece is the **Agent Ready Certified** badge — a verifiable trust
mark. Every badge links to a live re-audit of the store, so it can't be faked.
Certified stores get listed in the public directory.

## Headlines

- "Can AI agents buy from your store? Find out in 30 seconds."
- "Your competitors are already Agent Ready Certified."
- "Free gets you found. Pro gets you bought."
- "The badge shoppers — and agents — can actually verify."

## Funnel

1. **Free audit** (analyzer) → shows the store's AIO score and what's missing.
2. **Install the free plugin** → instantly fixes discovery (robots, llms.txt,
   schema, read API). Score jumps to ~50.
3. **Upgrade to Pro** → agentic checkout, enriched schema, full feed, advanced
   analytics, and the **certificate + badge**. Score to 100.
4. **Get listed** in the certified directory; embed the badge; run the "we're
   Agent Ready" announcement.

## Campaign assets in this repo

- **Analyzer** (`/`) — free lead magnet; shareable score.
- **Certified directory** (`Certified directory` nav) — social proof + SEO.
- **Verification page** (`/verify/:id`) — live, tamper-proof trust.
- **Badge** (`/api/badge`) — embeddable SVG in dark/light.
- **Plugin dashboard demo** — product tour.

## Email — cold (merchant)

> Subject: Can ChatGPT buy from {store}?
>
> We ran {store} through an AI-readiness audit. Right now an AI shopping agent
> can {read / can't buy} from you — score {N}/100. Here's the 2-minute fix, and
> the certificate you can put on your site once you pass: {link}

## Social — launch

> AI agents are the new storefront. We just certified our first {N} WooCommerce
> stores as **Agent Ready** — readable *and* buyable by ChatGPT, Claude &
> Gemini. Check if yours qualifies (free): {link}

## Pricing (edit in `src/Pricing.tsx`)

- Free — €0. Discovery only, AIO ≤ 50, uncertified.
- Pro — €149/yr/store. Checkout + analytics + enriched data + certificate, AIO
  to 100, gold certification.
- (Consider: Agency/multi-store tier, and a launch discount code.)

## Pre-launch checklist

- [ ] Run `TESTING.md` end-to-end on real WooCommerce.
- [ ] Replace `AFS_License::SECRET` and the generator secret; move to asymmetric
      signing or server activation before selling keys.
- [ ] Stand up the real license-issue endpoint behind Stripe/Lemon Squeezy.
- [ ] Host the update manifest at `AFS_UPDATE_URL` and publish the signed zip.
- [ ] Seed the directory with real certified stores.
- [ ] Legal: badge usage terms; what "certified" claims and for how long.
