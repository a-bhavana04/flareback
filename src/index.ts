import type { Env, QueueMessage } from './types';
import { handleQueue } from './queue-consumer';
import { scrapeGitHub } from './scrapers/github';
import { scrapeDiscourse } from './scrapers/discourse';
import { scrapeReddit } from './scrapers/reddit';
import { generateMockTweets } from './scrapers/mock-twitter';
import { generateMockTickets } from './scrapers/mock-tickets';
import { scrapeHackerNews } from './scrapers/hackernews';
import { scrapeStackOverflow } from './scrapers/stackoverflow';
import { scrapeDiscord } from './scrapers/discord';
import { scrapeDevTo } from './scrapers/devto';

export default {
  // HTTP handler — API endpoints
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      if (path === '/api/feedback' && request.method === 'GET') {
        return addCors(await handleListFeedback(url, env), corsHeaders);
      }
      if (path === '/api/stats' && request.method === 'GET') {
        return addCors(await handleStats(env), corsHeaders);
      }
      if (path.startsWith('/api/feedback/') && request.method === 'GET') {
        const id = path.split('/api/feedback/')[1];
        return addCors(await handleGetFeedback(id, env), corsHeaders);
      }
      if (path === '/api/ingest/trigger' && request.method === 'POST') {
        return addCors(await handleTrigger(url, env), corsHeaders);
      }
      if (path === '/api/ingest/reset-cursors' && request.method === 'POST') {
        return addCors(await handleResetCursors(env), corsHeaders);
      }

      return addCors(
        Response.json({ error: 'Not found' }, { status: 404 }),
        corsHeaders,
      );
    } catch (e) {
      console.error('Request error:', e);
      return addCors(
        Response.json({ error: 'Internal server error' }, { status: 500 }),
        corsHeaders,
      );
    }
  },

  // Cron handler — 5 triggers (free tier limit); sources grouped by frequency
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const cron = event.cron;
    console.log(`Cron triggered: ${cron}`);

    switch (cron) {
      case '0 */6 * * *':
        ctx.waitUntil(scrapeGitHub(env));
        ctx.waitUntil(scrapeDevTo(env));
        break;
      case '30 */6 * * *':
        ctx.waitUntil(scrapeDiscourse(env));
        break;
      case '0 */12 * * *':
        ctx.waitUntil(scrapeReddit(env));
        ctx.waitUntil(scrapeDiscord(env));
        break;
      case '30 */12 * * *':
        ctx.waitUntil(scrapeHackerNews(env));
        ctx.waitUntil(scrapeStackOverflow(env));
        break;
      case '0 0 * * *':
        ctx.waitUntil(generateMockTweets(env));
        ctx.waitUntil(generateMockTickets(env));
        break;
      default:
        console.log(`Unknown cron: ${cron}`);
    }
  },

  // Queue handler
  async queue(batch: MessageBatch<QueueMessage>, env: Env): Promise<void> {
    await handleQueue(batch, env);
  },
};

// --- API Handlers ---

async function handleListFeedback(url: URL, env: Env): Promise<Response> {
  const source = url.searchParams.get('source');
  const sentiment = url.searchParams.get('sentiment');
  const category = url.searchParams.get('category');
  const product = url.searchParams.get('product');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200);
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);

  let query = 'SELECT * FROM feedback_items WHERE 1=1';
  const params: (string | number)[] = [];

  if (source) {
    query += ' AND source = ?';
    params.push(source);
  }
  if (sentiment) {
    query += ' AND sentiment = ?';
    params.push(sentiment);
  }
  if (category) {
    query += ' AND category = ?';
    params.push(category);
  }
  if (product) {
    query += ' AND product = ?';
    params.push(product);
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const result = await env.DB.prepare(query).bind(...params).all();

  return Response.json({
    data: result.results,
    meta: { limit, offset, count: result.results.length },
  });
}

async function handleStats(env: Env): Promise<Response> {
  const [bySource, bySentiment, byCategory, byProduct, total] = await Promise.all([
    env.DB.prepare(
      'SELECT source, COUNT(*) as count FROM feedback_items GROUP BY source',
    ).all(),
    env.DB.prepare(
      'SELECT sentiment, COUNT(*) as count FROM feedback_items GROUP BY sentiment',
    ).all(),
    env.DB.prepare(
      'SELECT category, COUNT(*) as count FROM feedback_items GROUP BY category',
    ).all(),
    env.DB.prepare(
      'SELECT product, COUNT(*) as count FROM feedback_items GROUP BY product ORDER BY count DESC LIMIT 20',
    ).all(),
    env.DB.prepare('SELECT COUNT(*) as count FROM feedback_items').first<{ count: number }>(),
  ]);

  return Response.json({
    total: total?.count || 0,
    by_source: result2map(bySource.results),
    by_sentiment: result2map(bySentiment.results),
    by_category: result2map(byCategory.results),
    by_product: result2map(byProduct.results),
  });
}

function result2map(rows: Record<string, unknown>[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const row of rows) {
    const keys = Object.keys(row);
    const label = String(row[keys[0]] || 'unknown');
    map[label] = Number(row[keys[1]]) || 0;
  }
  return map;
}

async function handleGetFeedback(id: string, env: Env): Promise<Response> {
  const item = await env.DB.prepare(
    'SELECT * FROM feedback_items WHERE id = ?',
  )
    .bind(id)
    .first();

  if (!item) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  return Response.json({ data: item });
}

async function handleTrigger(url: URL, env: Env): Promise<Response> {
  const source = url.searchParams.get('source');
  const validSources = ['github', 'discourse', 'reddit', 'twitter_mock', 'support_mock', 'hackernews', 'stackoverflow', 'discord', 'devto', 'all'];

  if (!source || !validSources.includes(source)) {
    return Response.json(
      { error: `Invalid source. Use one of: ${validSources.join(', ')}` },
      { status: 400 },
    );
  }

  const results: Record<string, number> = {};

  if (source === 'github' || source === 'all') {
    results.github = await scrapeGitHub(env);
  }
  if (source === 'discourse' || source === 'all') {
    results.discourse = await scrapeDiscourse(env);
  }
  if (source === 'reddit' || source === 'all') {
    results.reddit = await scrapeReddit(env);
  }
  if (source === 'twitter_mock' || source === 'all') {
    results.twitter_mock = await generateMockTweets(env);
  }
  if (source === 'support_mock' || source === 'all') {
    results.support_mock = await generateMockTickets(env);
  }
  if (source === 'hackernews' || source === 'all') {
    results.hackernews = await scrapeHackerNews(env);
  }
  if (source === 'stackoverflow' || source === 'all') {
    results.stackoverflow = await scrapeStackOverflow(env);
  }
  if (source === 'discord' || source === 'all') {
    results.discord = await scrapeDiscord(env);
  }
  if (source === 'devto' || source === 'all') {
    results.devto = await scrapeDevTo(env);
  }

  return Response.json({ triggered: source, enqueued: results });
}

// Cursor keys used by scrapers for incremental fetching.
// After a DB purge, reset these so scrapers fetch from the beginning.
const CURSOR_KEYS = [
  'cursor:discourse',
  'cursor:hackernews',
  'cursor:devto',
  'cursor:stackoverflow',
  'cursor:reddit:CloudFlare',
  'cursor:github:cloudflare/workers-sdk',
  'cursor:github:cloudflare/cloudflare-docs',
  'cursor:github:cloudflare/workerd',
];

async function handleResetCursors(env: Env): Promise<Response> {
  await Promise.all(CURSOR_KEYS.map((key) => env.INGRESS_STATE.delete(key)));
  return Response.json({
    reset: true,
    keys_deleted: CURSOR_KEYS.length,
    message: 'Cursors reset. Trigger ingest again to fetch from the beginning.',
  });
}

function addCors(response: Response, headers: Record<string, string>): Response {
  const newHeaders = new Headers(response.headers);
  for (const [key, value] of Object.entries(headers)) {
    newHeaders.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    headers: newHeaders,
  });
}
