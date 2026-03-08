import type { Env, QueueMessage } from '../types';
import { getCursor, setCursor } from '../lib/cursor';

const API_URL = 'https://api.stackexchange.com/2.3';
const CURSOR_KEY = 'cursor:stackoverflow';

interface SOQuestion {
  question_id: number;
  title: string;
  body_markdown?: string;
  link: string;
  owner: { display_name: string; user_id?: number };
  creation_date: number;
  score: number;
  answer_count: number;
  view_count: number;
  tags: string[];
  is_answered: boolean;
}

interface SOResponse {
  items: SOQuestion[];
  has_more: boolean;
  quota_remaining: number;
}

export async function scrapeStackOverflow(env: Env): Promise<number> {
  const cursor = await getCursor<{ last_activity: string }>(env.INGRESS_STATE, CURSOR_KEY);
  const lastActivity = cursor
    ? parseInt(cursor.last_activity, 10)
    : Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;

  // Search for questions tagged cloudflare, or mentioning cloudflare workers/pages/etc
  const url = `${API_URL}/questions?` + new URLSearchParams({
    order: 'desc',
    sort: 'creation',
    tagged: 'cloudflare',
    fromdate: lastActivity.toString(),
    pagesize: '50',
    site: 'stackoverflow',
    filter: 'withbody',
  }).toString();

  const response = await fetch(url, {
    headers: { 'Accept-Encoding': 'gzip', 'User-Agent': 'cf-feedback-aggregator' },
  });

  if (!response.ok) {
    console.error(`StackOverflow: HTTP ${response.status}`);
    return 0;
  }

  const data = (await response.json()) as SOResponse;
  console.log(`StackOverflow: quota remaining = ${data.quota_remaining}`);

  if (data.items.length === 0) {
    console.log('StackOverflow: no new questions');
    return 0;
  }

  const messages: QueueMessage[] = [];
  let maxCreation = lastActivity;

  for (const q of data.items) {
    const body = (q.body_markdown || '')
      .replace(/<[^>]*>/g, '')
      .slice(0, 2000);

    messages.push({
      source: 'stackoverflow',
      source_id: `so-${q.question_id}`,
      source_url: q.link,
      title: q.title,
      body,
      author: q.owner.display_name,
      created_at: new Date(q.creation_date * 1000).toISOString(),
      upvotes: q.score,
      comment_count: q.answer_count,
      view_count: q.view_count,
      metadata: {
        tags: q.tags,
        is_answered: q.is_answered,
        question_id: q.question_id,
      },
    });

    if (q.creation_date > maxCreation) {
      maxCreation = q.creation_date;
    }
  }

  await env.FEEDBACK_QUEUE.sendBatch(
    messages.map((msg) => ({ body: msg })),
  );

  await setCursor(env.INGRESS_STATE, CURSOR_KEY, {
    last_activity: (maxCreation + 1).toString(),
  });

  console.log(`StackOverflow: enqueued ${messages.length} questions`);
  return messages.length;
}
