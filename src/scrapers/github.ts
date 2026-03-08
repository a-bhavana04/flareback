import type { Env, QueueMessage } from '../types';
import { getCursor, setCursor } from '../lib/cursor';

const REPOS = [
  { owner: 'cloudflare', repo: 'workers-sdk' },
  { owner: 'cloudflare', repo: 'cloudflare-docs' },
  { owner: 'cloudflare', repo: 'workerd' },
];

interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  user: { login: string } | null;
  html_url: string;
  created_at: string;
  updated_at: string;
  comments: number;
  reactions?: { total_count?: number };
  labels?: Array<{ name: string }>;
}

interface GitHubCursor {
  since: string;
  etag: string;
}

export async function scrapeGitHub(env: Env): Promise<number> {
  let totalEnqueued = 0;

  for (const { owner, repo } of REPOS) {
    const cursorKey = `cursor:github:${owner}/${repo}`;
    const cursor = await getCursor<GitHubCursor>(env.INGRESS_STATE, cursorKey);

    const since = cursor?.since || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const url = `https://api.github.com/repos/${owner}/${repo}/issues?since=${since}&sort=updated&direction=asc&per_page=100&state=all`;

    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'cf-feedback-aggregator',
    };
    if (env.GITHUB_TOKEN) {
      headers['Authorization'] = `Bearer ${env.GITHUB_TOKEN}`;
    }
    if (cursor?.etag) {
      headers['If-None-Match'] = cursor.etag;
    }

    const response = await fetch(url, { headers });

    if (response.status === 304) {
      console.log(`GitHub ${owner}/${repo}: no new updates (304)`);
      continue;
    }

    // Rate limit awareness (inspired by crowd.dev's RateLimitError pattern)
    if (response.status === 403 || response.status === 429) {
      const resetHeader = response.headers.get('x-ratelimit-reset');
      const resetAt = resetHeader ? new Date(parseInt(resetHeader, 10) * 1000).toISOString() : 'unknown';
      const remaining = response.headers.get('x-ratelimit-remaining');
      console.error(`GitHub ${owner}/${repo}: rate limited (${response.status}), remaining=${remaining}, resets at ${resetAt}`);
      continue;
    }

    if (!response.ok) {
      console.error(`GitHub ${owner}/${repo}: HTTP ${response.status}`);
      continue;
    }

    const issues = (await response.json()) as GitHubIssue[];
    const messages: QueueMessage[] = [];

    for (const issue of issues) {
      messages.push({
        source: 'github',
        source_id: `${owner}/${repo}#${issue.number}`,
        source_url: issue.html_url,
        title: issue.title,
        body: (issue.body || '').slice(0, 2000),
        author: issue.user?.login || 'unknown',
        created_at: issue.created_at,
        upvotes: issue.reactions?.total_count || 0,
        comment_count: issue.comments,
        metadata: {
          repo: `${owner}/${repo}`,
          labels: issue.labels?.map((l) => l.name) || [],
          updated_at: issue.updated_at,
        },
      });
    }

    // Batch enqueue (inspired by crowd.dev's batch processing pattern)
    await env.FEEDBACK_QUEUE.sendBatch(
      messages.map((msg) => ({ body: msg })),
    );
    totalEnqueued += messages.length;

    // Update cursor
    const newEtag = response.headers.get('etag') || '';
    const latestUpdate = issues.length > 0
      ? issues[issues.length - 1].updated_at
      : since;

    await setCursor(env.INGRESS_STATE, cursorKey, {
      since: latestUpdate,
      etag: newEtag,
    });

    console.log(`GitHub ${owner}/${repo}: enqueued ${messages.length} issues`);
  }

  return totalEnqueued;
}
