# Deploying CF Feedback Aggregator to Your Own Account

## Prerequisites

- Node.js 18+
- npm
- A Cloudflare account (free tier works)

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Authenticate Wrangler

```bash
npx wrangler login
```

This opens a browser window. Log in and authorize wrangler.

Verify with:
```bash
npx wrangler whoami
```

## Step 3: Register a workers.dev Subdomain

If you haven't already, go to your Cloudflare dashboard:
```
https://dash.cloudflare.com/<YOUR_ACCOUNT_ID>/workers/onboarding
```
Pick a subdomain (e.g. `yourname.workers.dev`).

**Important:** If you have Cloudflare Access (Zero Trust) enabled on your `*.workers.dev` subdomain, disable it or add a bypass rule, otherwise all API requests will get a 302 redirect. Go to: Zero Trust dashboard > Access > Applications.

## Step 4: Create Cloudflare Resources

Run these three commands and **note the IDs** printed in the output:

```bash
# Create D1 database
npx wrangler d1 create feedback-db

# Create KV namespace
npx wrangler kv namespace create INGRESS_STATE

# Create Queue
npx wrangler queues create feedback-ingress
```

## Step 5: Update wrangler.toml

Open `wrangler.toml` and replace the placeholder IDs with the ones from Step 4:

```toml
# Replace database_id with your D1 database ID
[[d1_databases]]
binding = "DB"
database_name = "feedback-db"
database_id = "<YOUR_D1_DATABASE_ID>"

# Replace id with your KV namespace ID
[[kv_namespaces]]
binding = "INGRESS_STATE"
id = "<YOUR_KV_NAMESPACE_ID>"
```

The queue, AI, and observability bindings don't need ID changes.

## Step 6: Apply Database Schema

```bash
npx wrangler d1 execute feedback-db --remote --file=./migrations/0001_init.sql
```

Verify it worked:
```bash
npx wrangler d1 execute feedback-db --remote --command "SELECT name FROM sqlite_master WHERE type='table'"
```

You should see `feedback_items`.

## Step 7: Set Up Data Sources

The tool scrapes from 9 sources. Some work out of the box, others need credentials.

### Sources that work without any setup

| Source | Description |
|---|---|
| **Discourse** | Cloudflare Community Forum (community.cloudflare.com). Public API, no auth needed. |
| **HackerNews** | Cloudflare-related stories via Algolia search API. Public, no auth needed. |
| **Dev.to** | Cloudflare-tagged articles. Public API, no auth needed. |
| **Mock Tweets** | AI-generated realistic tweets about CF products via Workers AI. |
| **Mock Support Tickets** | AI-generated realistic support tickets via Workers AI. |

### GitHub (recommended)

GitHub works without a token but is limited to 60 requests/hour. With a PAT you get 5,000 req/hr.

1. Go to https://github.com/settings/tokens
2. Click **"Generate new token (classic)"**
3. No scopes needed (public repo access only) — just give it a name
4. Copy the token
5. Set it:
```bash
npx wrangler secret put GITHUB_TOKEN
```
Paste the token when prompted.

### Reddit

Scrapes r/CloudFlare for posts. Requires OAuth credentials.

1. Go to https://www.reddit.com/prefs/apps
2. Click **"create another app..."** at the bottom
3. Fill in:
   - **name:** cf-feedback-aggregator
   - **type:** select **script**
   - **redirect uri:** http://localhost:8080 (not actually used)
4. Click **"create app"**
5. Note the **client ID** (shown under the app name) and **secret**
6. Set them:
```bash
npx wrangler secret put REDDIT_CLIENT_ID
npx wrangler secret put REDDIT_CLIENT_SECRET
```

### Discord

Scrapes messages from a Discord server you control. Requires a bot.

1. Go to https://discord.com/developers/applications
2. Click **"New Application"** > give it a name > click **"Create"**
3. Select **"Build a Bot"** when prompted
4. Go to **Bot** in the left sidebar:
   - Click **"Reset Token"** > copy the token
   - Under **Privileged Gateway Intents**, enable **Message Content Intent**
5. Go to **OAuth2 > URL Generator** in the left sidebar:
   - Under **Scopes**, check `bot`
   - Under **Bot Permissions**, check `Read Message History` and `View Channels`
   - Copy the generated URL at the bottom
6. Open that URL in your browser to **invite the bot to your server**
7. Set the token:
```bash
npx wrangler secret put DISCORD_BOT_TOKEN
```

**Server setup:** Create text channels in your server (e.g. `#workers-help`, `#pages-help`, `#general`) and have people post Cloudflare-related feedback. The scraper auto-discovers all text channels.

**Note:** The scraper uses server ID `1479584172006703124` by default. To use your own server, update `GUILD_ID` in `src/scrapers/discord.ts`.

### StackOverflow

Works without any setup. Uses the public Stack Exchange API to fetch questions tagged `[cloudflare]`. The free tier allows 300 requests/day which is more than enough.

## Step 8: Deploy

```bash
npx wrangler deploy
```

You should see output like:
```
Uploaded cf-feedback-aggregator
Deployed cf-feedback-aggregator triggers
  https://cf-feedback-aggregator.<your-subdomain>.workers.dev
  schedule: */15 * * * *
  schedule: 0 * * * *
  schedule: 0 */4 * * *
  Producer for feedback-ingress
  Consumer for feedback-ingress
```

## Step 9: Trigger and Verify

### Test individual sources
```bash
BASE=https://cf-feedback-aggregator.<your-subdomain>.workers.dev

# Sources that work immediately (no auth needed)
curl -X POST "$BASE/api/ingest/trigger?source=discourse"
curl -X POST "$BASE/api/ingest/trigger?source=hackernews"
curl -X POST "$BASE/api/ingest/trigger?source=devto"
curl -X POST "$BASE/api/ingest/trigger?source=stackoverflow"
curl -X POST "$BASE/api/ingest/trigger?source=twitter_mock"
curl -X POST "$BASE/api/ingest/trigger?source=support_mock"

# Sources that need secrets (set them first)
curl -X POST "$BASE/api/ingest/trigger?source=github"
curl -X POST "$BASE/api/ingest/trigger?source=reddit"
curl -X POST "$BASE/api/ingest/trigger?source=discord"

# Or trigger everything at once
curl -X POST "$BASE/api/ingest/trigger?source=all"
```

### Wait ~30 seconds for the queue to process, then check results
```bash
# Aggregated stats
curl "$BASE/api/stats"

# List feedback with filters
curl "$BASE/api/feedback?source=github&limit=5"
curl "$BASE/api/feedback?sentiment=negative&category=bug&limit=10"
curl "$BASE/api/feedback?product=Workers&limit=10"
```

### Check the database directly
```bash
npx wrangler d1 execute feedback-db --remote --command "SELECT count(*), source FROM feedback_items GROUP BY source"
```

## Step 10: Import Postman Collection (Optional)

Import `postman_collection.json` into Postman and update the `base_url` collection variable to your worker URL.

## Cron Schedule

Once deployed, these scrapers run automatically:

| Schedule | Sources |
|---|---|
| Every 15 min | GitHub, Dev.to |
| Every hour | Discourse, Reddit, Discord, HackerNews |
| Every 4 hours | StackOverflow, Mock Tweets, Mock Tickets |

## Monitoring

### View live logs
```bash
npx wrangler tail --format=pretty
```

### Dashboard logs
Observability is enabled. View logs in the Cloudflare dashboard:
Workers & Pages > cf-feedback-aggregator > Logs

## API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/api/stats` | GET | Aggregated counts by source, sentiment, category, product |
| `/api/feedback` | GET | List items. Query params: `source`, `sentiment`, `category`, `product`, `limit` (max 200), `offset` |
| `/api/feedback/:id` | GET | Single item by ID |
| `/api/ingest/trigger?source=` | POST | Manually trigger a scraper. Values: `github`, `discourse`, `reddit`, `discord`, `hackernews`, `stackoverflow`, `devto`, `twitter_mock`, `support_mock`, `all` |

## Troubleshooting

**"You need to register a workers.dev subdomain"**
Visit `https://dash.cloudflare.com/<ACCOUNT_ID>/workers/onboarding`

**302 redirect to cloudflareaccess.com**
Cloudflare Access (Zero Trust) is blocking requests. Disable the Access policy at: Zero Trust dashboard > Access > Applications

**GitHub rate limited (403)**
Set a GitHub PAT: `npx wrangler secret put GITHUB_TOKEN`

**Reddit returns 0 items**
Set Reddit OAuth credentials. Verify they work: the trigger response should show `"reddit": <number>`.

**Discord returns 0 items**
- Ensure the bot has been invited to your server
- Ensure **Message Content Intent** is enabled in the bot settings
- Ensure the bot has Read Message History + View Channels permissions
- Update `GUILD_ID` in `src/scrapers/discord.ts` to your server ID

**StackOverflow quota exceeded**
The free tier allows 300 requests/day. If exceeded, it resets at midnight UTC.

**Queue not processing**
Check `npx wrangler tail --format=pretty` for errors. The queue processes batches of 10 with a 30-second timeout.

## Tear Down

To remove everything:
```bash
npx wrangler delete
npx wrangler d1 delete feedback-db
npx wrangler kv namespace delete --namespace-id=<YOUR_KV_NAMESPACE_ID>
npx wrangler queues delete feedback-ingress
```

To remove secrets:
```bash
npx wrangler secret delete GITHUB_TOKEN
npx wrangler secret delete REDDIT_CLIENT_ID
npx wrangler secret delete REDDIT_CLIENT_SECRET
npx wrangler secret delete DISCORD_BOT_TOKEN
```
