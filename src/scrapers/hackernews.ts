import type { Env, QueueMessage } from '../types';
import { getCursor, setCursor } from '../lib/cursor';

const SEARCH_URL = 'https://hn.algolia.com/api/v1/search_by_date';
const CURSOR_KEY = 'cursor:hackernews';

interface HNHit {
  objectID: string;
  title: string | null;
  story_text: string | null;
  comment_text: string | null;
  url: string | null;
  author: string;
  created_at: string;
  created_at_i: number;
  points: number | null;
  num_comments: number | null;
  story_id: number | null;
  story_title: string | null;
}

interface HNSearchResult {
  hits: HNHit[];
}

export async function scrapeHackerNews(env: Env): Promise<number> {
  const cursor = await getCursor<{ last_timestamp: string }>(env.INGRESS_STATE, CURSOR_KEY);
  const lastTimestamp = cursor
    ? parseInt(cursor.last_timestamp, 10)
    : Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;

  // Search for Cloudflare-related stories and comments
  const queries = [
    `${SEARCH_URL}?query=cloudflare&tags=story&numericFilters=created_at_i>${lastTimestamp}&hitsPerPage=50`,
    `${SEARCH_URL}?query=cloudflare+workers&tags=story&numericFilters=created_at_i>${lastTimestamp}&hitsPerPage=30`,
  ];

  const allHits = new Map<string, HNHit>();

  for (const url of queries) {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'cf-feedback-aggregator' },
    });

    if (!response.ok) {
      console.error(`HackerNews: HTTP ${response.status} for ${url}`);
      continue;
    }

    const data = (await response.json()) as HNSearchResult;
    for (const hit of data.hits) {
      allHits.set(hit.objectID, hit);
    }
  }

  if (allHits.size === 0) {
    console.log('HackerNews: no new items');
    return 0;
  }

  const messages: QueueMessage[] = [];
  let maxTimestamp = lastTimestamp;

  for (const hit of allHits.values()) {
    const body = hit.story_text || hit.comment_text || '';
    const title = hit.title || hit.story_title || '';
    const cleanBody = body.replace(/<[^>]*>/g, '').slice(0, 2000);

    // Determine where Cloudflare was referenced for display in the feed
    const titleLower = (title || '').toLowerCase();
    const bodyLower = (cleanBody || '').toLowerCase();
    const hasCloudflareInTitle = titleLower.includes('cloudflare');
    const hasCloudflareInBody = bodyLower.includes('cloudflare');
    const isComment = !!hit.comment_text && !hit.story_text;

    let cloudflare_reference: string;
    if (isComment) {
      cloudflare_reference = 'comment';
    } else if (hasCloudflareInTitle) {
      cloudflare_reference = 'story_title';
    } else if (hasCloudflareInBody) {
      cloudflare_reference = 'story_body';
    } else {
      cloudflare_reference = 'search_match';
    }

    messages.push({
      source: 'hackernews',
      source_id: `hn-${hit.objectID}`,
      source_url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
      title: title.slice(0, 500),
      body: cleanBody,
      author: hit.author,
      created_at: hit.created_at,
      upvotes: hit.points || 0,
      comment_count: hit.num_comments || 0,
      metadata: {
        hn_id: hit.objectID,
        story_id: hit.story_id,
        story_title: hit.story_title,
        original_url: hit.url,
        cloudflare_reference,
        is_comment: isComment,
      },
    });

    if (hit.created_at_i > maxTimestamp) {
      maxTimestamp = hit.created_at_i;
    }
  }

  await env.FEEDBACK_QUEUE.sendBatch(
    messages.map((msg) => ({ body: msg })),
  );

  await setCursor(env.INGRESS_STATE, CURSOR_KEY, {
    last_timestamp: maxTimestamp.toString(),
  });

  console.log(`HackerNews: enqueued ${messages.length} items`);
  return messages.length;
}
