# CF Feedback Aggregator

**Cloudflare PM Intern Assignment — Product Feedback Aggregation Prototype**

A prototype that aggregates and analyzes product feedback from multiple sources (GitHub, Discourse, Reddit, Discord, HackerNews, StackOverflow, Dev.to, and mock sources) so PMs can derive themes, urgency, value, and sentiment.

---

## Project Links

- **Demo (API):** https://cf-feedback-aggregator.banand.workers.dev
- **Frontend:** _[Add your deployed frontend URL here, e.g. Vercel or Cloudflare Pages]_
- **GitHub:** _[Add your repo URL here]_

---

## Architecture

This prototype uses **5 Cloudflare Developer Platform products**:

| Product | Purpose |
|---------|---------|
| **Workers** | HTTP API, cron triggers, queue consumer |
| **D1** | Store feedback items (source, sentiment, category, product, etc.) |
| **KV** | Deduplication state and scraping cursors for incremental fetch |
| **Queues** | Async pipeline: scrapers enqueue → consumer processes |
| **Workers AI** | Sentiment analysis and categorization (Llama 3.1) |

**Flow:** Scrapers → Queue → Consumer (dedup + AI enrichment + skip filter) → D1 → API → Frontend

### Cloudflare Workers Bindings

<!-- Add screenshot: Workers & Pages > cf-feedback-aggregator > Overview or Bindings -->
<!-- Save as docs/workers-bindings.png -->

![Workers Bindings](docs/workers-bindings.png)

### Frontend Dashboard

<!-- Add screenshot of your deployed frontend (dashboard or feed) -->
<!-- Save as docs/frontend-dashboard.png -->

![Frontend Dashboard](docs/frontend-dashboard.png)

---

## Features

- **9 feedback sources:** GitHub, Discourse, Reddit, Discord, HackerNews, StackOverflow, Dev.to, mock tweets, mock support tickets
- **AI enrichment:** Sentiment, category (bug/feature-request/question/praise/complaint), product, priority
- **Noise filtering:** Skips short reactions ("oh totally", "lol") and non-substantive content
- **HackerNews context:** Shows where Cloudflare was referenced (title, article, comment)
- **Dashboard:** Stats, charts (sources, sentiment, categories, products), recent feedback
- **Feed:** Filterable, paginated list with badges

---

## Quick Start

```bash
npm install
npx wrangler login
npx wrangler d1 execute feedback-db --remote --file=./migrations/0001_init.sql
npx wrangler deploy
```

See [migrate.md](migrate.md) for full setup (D1, KV, Queue creation, secrets).

### Trigger Ingestion

```bash
# Reset cursors after DB purge (so scrapers fetch from the beginning)
curl -X POST "https://cf-feedback-aggregator.banand.workers.dev/api/ingest/reset-cursors"

# Trigger all sources
curl -X POST "https://cf-feedback-aggregator.banand.workers.dev/api/ingest/trigger?source=all"
```

---

## API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/stats` | GET | Aggregated counts by source, sentiment, category, product |
| `/api/feedback` | GET | List items. Params: `source`, `sentiment`, `category`, `product`, `limit`, `offset` |
| `/api/feedback/:id` | GET | Single item |
| `/api/ingest/trigger?source=` | POST | Trigger scraper. Values: `github`, `discourse`, `reddit`, `discord`, `hackernews`, `stackoverflow`, `devto`, `twitter_mock`, `support_mock`, `all` |
| `/api/ingest/reset-cursors` | POST | Reset KV cursors (use after DB purge to re-fetch) |

---

## Cloudflare Product Insights

_For the PDF submission, include 3–5 friction points from your experience building this prototype. Format: Title, Problem, Suggestion._

---

## Vibe-Coding Context

_Built with Cursor. Used prompts for: [e.g. "add skip logic for noise content", "improve AI categorizer prompt", "add reset-cursors endpoint"]._
