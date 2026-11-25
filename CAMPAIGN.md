# Making AIO the new SEO — executable campaign strategy

**Goal:** own the term **AIO (AI Optimization)** the way "SEO" was owned in 2005,
with Agent Ready Shop as the reference tool, score and fix.

**Why this can work — the SEO-craze playbook, replicated:**
SEO became an industry because it had (1) a *number* people obsessed over,
(2) a *free audit tool* that generated fear, (3) *consultants* who could sell
services around it, (4) a *visible loser/winner dynamic* (your competitor
outranks you). We have all four: the AIO score, the analyzer, agencies, and
the public league table.

---

## Phase 0 — Foundation (week 0–1) · "be the reference"

1. **Dogfood to 100.** agentreadyshop.com itself must score 100/100 (llms.txt,
   schema, feed, manifest). The audit of our own domain is the demo.
2. **Publish the scoring methodology** as a public page (`/methodology`):
   the exact rubric (robots 15 / schema 20 / llms 15 / feed 15 / api 15 /
   agent-layer 20), what each check fetches, and why. Transparency = Lighthouse-
   grade credibility; also pre-empts "your score is rigged toward your plugin".
3. **Pillar content:** one definitive "What is AIO?" long-read (2–3k words,
   the term definition, the rubric, the checklist). This is the page every
   later mention links to → owns the SERP + LLM citations for "AIO".
4. Ship the essentials already built: hosted analyzer, shareable audit links
   (`/?audit=domain`), plugin on WordPress.org (see RELEASE.md), OG share cards.

**KPI:** our own audit = 100; methodology page live; plugin approved on wp.org.

## Phase 1 — Data-driven PR (week 2–4) · "the AIO Index"

The single highest-leverage move. SEO's craze moment was rankings; ours is:

5. **Audit the top 100–500 e-shops per market** with the analyzer (start
   SK/CZ — small ponds, loud echo; then DE/US verticals). One script, one
   afternoon: `for domain in list: GET /api/run-audit`.
6. **Publish "The AIO Index 2026"** — interactive league table, each row links
   to the live shareable audit. The story writes itself:
   - *"7 of 10 top e-shops are invisible to AI shoppers."*
   - *"X% actively block ChatGPT at the firewall"* (our WAF detection makes
     this a real, defensible finding — e.g. Alza's edge challenges bots).
   - *"Not one supports an agent completing a purchase."*
7. **Pitch the index** to e-commerce/tech media, newsletters and podcasts.
   Every ranked store is simultaneously a lead (they'll want to fix their
   score) and an amplifier (winners share their rank).
8. **Launch stack the same week:** Product Hunt + "Show HN: Lighthouse for AI
   shopping agents" + r/ecommerce, r/woocommerce, r/SEO.

**KPI:** 2+ media pickups, 5k analyzer runs, 500 plugin installs.

## Phase 2 — Viral loops (ongoing from week 2) · "make sharing the default"

9. **Score share cards** — every audit ends with "Share report" (built) and a
   downloadable score card image for LinkedIn/X: *"my store: 85/100 AIO"*.
10. **Compare mode** — audit two domains side by side ("you vs. your biggest
    competitor"). Fear is the sharpest hook in the SEO playbook. *(roadmap item)*
11. **Badge backlink flywheel** — every certified store embeds the badge that
    links to its verification page. Classic "Protected by CloudFlare" mechanic:
    each customer becomes a permanent backlink + billboard. This is why the
    badge exists — as the *loop*, not the pitch.
12. **Embeddable score widget for everyone** (even non-customers): a small
    "AIO 43/100 — audit by AgentReadyShop" snippet bloggers can embed when
    writing about stores.

**KPI:** ≥15% of audits shared; ≥60% of Pro customers embed the badge.

## Phase 3 — Arm the consultants (month 2–3) · "give the industry a product to sell"

SEO exploded because thousands of freelancers could *sell* it. Recreate that:

13. **Agency program:** multi-store license tier + **white-label PDF audit
    reports** (their logo on our report) + 30% recurring commission. An agency
    that can charge €500 for an "AIO audit" they generate in 30 seconds will
    evangelize harder than any ad budget.
14. **Court the SEO industry, don't fight it.** Pitch AIO to SEO newsletters,
    podcasts and tool-roundup authors as *"the next line item on your
    invoice"*. SEO consultants are actively hunting for a post-Google story —
    hand them one, with a tool.
15. **Free "AIO Checklist" lead magnet** (PDF of the rubric) + a certification
    course later ("AIO Certified Consultant") — the SEO-industry ritual.
16. **WordCamp/meetup talks** + guest posts on WooCommerce agency blogs.

**KPI:** 25 active agencies; agencies >30% of Pro revenue.

## Phase 4 — Standardize & moat (month 3–6) · "become the spec"

17. **Open the spec.** Publish the AIO rubric as a versioned open spec repo
    (like schema.org / a11y scores); accept issues/PRs. Whoever writes the
    spec grades the homework — competitors then *implement your standard*.
18. **Case studies with real numbers** from plugin analytics: *"Store X: +38%
    AI-referral sessions in 60 days after fixing 4 gaps."* Revenue proof turns
    the craze into a budget line.
19. **Weekly "AIO Report" newsletter:** score movements in the index,
    new agent capabilities (ChatGPT checkout, Perplexity shopping), teardowns.
20. **Widen the funnel:** Shopify app port of the analyzer layer; per-platform
    adapters (EDD, SureCart); public API for the analyzer so tool-builders
    integrate the score (and cite us).

**KPI:** spec repo stars/forks; 3 case studies; newsletter 2k subs; 5k active installs.

---

## The narrative (repeat everywhere, verbatim)

> "In 2005 you optimized for Google or you didn't exist.
>  In 2026 you optimize for agents or you don't get bought.
>  **SEO got you found. AIO gets you bought.**"

## Sequencing summary

| Week | Action | Output |
|---|---|---|
| 0–1 | Dogfood 100, methodology page, wp.org submit | Credibility base |
| 2 | Audit top-100 SK/CZ, build index page | The story |
| 3 | Index PR push + PH/HN launch | Traffic spike |
| 4+ | Share cards, badge flywheel running | Compounding loop |
| 5–8 | Agency program + SEO-industry outreach | Distribution army |
| 9–24 | Open spec, case studies, newsletter, Shopify port | Moat |

## Budget reality (bootstrap-friendly)

Phases 0–2 cost ~€0 in media (tool + data do the PR). First spend that makes
sense: sponsoring 2–3 SEO/e-comm newsletters (~€300–800/issue) *after* the
index exists, so the ad lands on a story, not a pitch.

## Risks & honest counters

- **"AIO" naming collision** (some say AEO/GEO/LLMO): don't fight it —
  rank for all of them, define them all on the pillar page, keep "AIO" as ours.
- **Big platforms ship native agent layers** (Shopify/OpenAI): position the
  plugin as the *WordPress-native* implementation and the analyzer/index as
  *platform-neutral referee* — referees survive standard shifts.
- **Craze fatigue/skepticism:** every claim in the index links to a live,
  re-runnable audit. Verifiability is the anti-snake-oil differentiator.
