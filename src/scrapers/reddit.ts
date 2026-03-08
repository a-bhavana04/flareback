import type { Env, QueueMessage } from '../types';
import { getCursor, setCursor } from '../lib/cursor';

const SUBREDDIT = 'CloudFlare';
const TOKEN_KEY = 'token:reddit';
const CURSOR_KEY = `cursor:reddit:${SUBREDDIT}`;

interface RedditToken {
  access_token: string;
  expires_at: number;
}

interface RedditPost {
  data: {
    id: string;
    title: string;
    selftext: string;
    author: string;
    permalink: string;
    created_utc: number;
    score: number;
    num_comments: number;
    link_flair_text?: string;
  };
}

interface RedditListing {
  data: {
    children: RedditPost[];
  };
}

async function getRedditToken(env: Env): Promise<string | null> {
  // Check cached token
  const cached = await env.INGRESS_STATE.get(TOKEN_KEY);
  if (cached) {
    const token = JSON.parse(cached) as RedditToken;
    if (token.expires_at > Date.now()) {
      return token.access_token;
    }
  }

  if (!env.REDDIT_CLIENT_ID || !env.REDDIT_CLIENT_SECRET) {
    console.error('Reddit: missing credentials');
    return null;
  }

  const auth = btoa(`${env.REDDIT_CLIENT_ID}:${env.REDDIT_CLIENT_SECRET}`);
  const response = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'cf-feedback-aggregator/1.0',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    console.error(`Reddit auth: HTTP ${response.status}`);
    return null;
  }

  const data = (await response.json()) as { access_token: string; expires_in: number };
  const tokenData: RedditToken = {
    access_token: data.access_token,
    expires_at: Date.now() + (data.expires_in - 300) * 1000, // 5 min buffer
  };

  await env.INGRESS_STATE.put(TOKEN_KEY, JSON.stringify(tokenData), {
    expirationTtl: data.expires_in - 60,
  });

  return data.access_token;
}

export async function scrapeReddit(env: Env): Promise<number> {
  const token = await getRedditToken(env);
  if (!token) return 0;

  const cursor = await getCursor<{ last_created_utc: string }>(
    env.INGRESS_STATE,
    CURSOR_KEY,
  );
  const lastCreatedUtc = cursor
    ? parseFloat(cursor.last_created_utc)
    : (Date.now() / 1000) - 7 * 24 * 60 * 60;

  const response = await fetch(
    `https://oauth.reddit.com/r/${SUBREDDIT}/new.json?limit=100`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'cf-feedback-aggregator/1.0',
      },
    },
  );

  if (!response.ok) {
    console.error(`Reddit: HTTP ${response.status}`);
    return 0;
  }

  const listing = (await response.json()) as RedditListing;
  const posts = listing.data.children;

  const newPosts = posts.filter(
    (p) => p.data.created_utc > lastCreatedUtc,
  );

  if (newPosts.length === 0) {
    console.log('Reddit: no new posts');
    return 0;
  }

  for (const post of newPosts) {
    const msg: QueueMessage = {
      source: 'reddit',
      source_id: `reddit-${post.data.id}`,
      source_url: `https://www.reddit.com${post.data.permalink}`,
      title: post.data.title,
      body: (post.data.selftext || '').slice(0, 2000),
      author: post.data.author,
      created_at: new Date(post.data.created_utc * 1000).toISOString(),
      upvotes: post.data.score,
      comment_count: post.data.num_comments,
      metadata: {
        flair: post.data.link_flair_text || null,
        subreddit: SUBREDDIT,
      },
    };

    await env.FEEDBACK_QUEUE.send(msg);
  }

  // Update cursor
  const maxCreatedUtc = Math.max(...newPosts.map((p) => p.data.created_utc));
  await setCursor(env.INGRESS_STATE, CURSOR_KEY, {
    last_created_utc: maxCreatedUtc.toString(),
  });

  console.log(`Reddit: enqueued ${newPosts.length} posts`);
  return newPosts.length;
}
