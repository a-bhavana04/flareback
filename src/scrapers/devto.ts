import type { Env, QueueMessage } from '../types';
import { getCursor, setCursor } from '../lib/cursor';

const API_URL = 'https://dev.to/api';
const CURSOR_KEY = 'cursor:devto';

interface DevToArticle {
  id: number;
  title: string;
  description: string;
  body_markdown?: string;
  url: string;
  user: { username: string; name: string };
  created_at: string;
  published_at: string;
  positive_reactions_count: number;
  comments_count: number;
  page_views_count?: number;
  tag_list: string[];
  reading_time_minutes: number;
}

export async function scrapeDevTo(env: Env): Promise<number> {
  const cursor = await getCursor<{ last_id: string }>(env.INGRESS_STATE, CURSOR_KEY);
  const lastId = cursor ? parseInt(cursor.last_id, 10) : 0;

  // Search for Cloudflare-related articles
  const searches = ['cloudflare', 'cloudflare workers', 'cloudflare pages'];
  const allArticles = new Map<number, DevToArticle>();

  for (const query of searches) {
    const url = `${API_URL}/articles?tag=cloudflare&per_page=30&state=fresh`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'cf-feedback-aggregator',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`Dev.to: HTTP ${response.status} for query "${query}"`);
      continue;
    }

    const articles = (await response.json()) as DevToArticle[];
    for (const article of articles) {
      if (article.id > lastId) {
        allArticles.set(article.id, article);
      }
    }

    // Also search by keyword
    const searchUrl = `${API_URL}/articles?per_page=30&state=fresh`;
    const searchResp = await fetch(`${searchUrl}&tag=${encodeURIComponent(query)}`, {
      headers: { 'User-Agent': 'cf-feedback-aggregator', 'Accept': 'application/json' },
    });

    if (searchResp.ok) {
      const searchArticles = (await searchResp.json()) as DevToArticle[];
      for (const article of searchArticles) {
        if (article.id > lastId) {
          allArticles.set(article.id, article);
        }
      }
    }
  }

  if (allArticles.size === 0) {
    console.log('Dev.to: no new articles');
    return 0;
  }

  const messages: QueueMessage[] = [];
  let maxId = lastId;

  for (const article of allArticles.values()) {
    messages.push({
      source: 'devto',
      source_id: `devto-${article.id}`,
      source_url: article.url,
      title: article.title,
      body: (article.description || '').slice(0, 2000),
      author: article.user.username,
      created_at: article.published_at || article.created_at,
      upvotes: article.positive_reactions_count,
      comment_count: article.comments_count,
      view_count: article.page_views_count || 0,
      metadata: {
        tags: article.tag_list,
        reading_time: article.reading_time_minutes,
        author_name: article.user.name,
      },
    });

    if (article.id > maxId) {
      maxId = article.id;
    }
  }

  await env.FEEDBACK_QUEUE.sendBatch(
    messages.map((msg) => ({ body: msg })),
  );

  await setCursor(env.INGRESS_STATE, CURSOR_KEY, {
    last_id: maxId.toString(),
  });

  console.log(`Dev.to: enqueued ${messages.length} articles`);
  return messages.length;
}
