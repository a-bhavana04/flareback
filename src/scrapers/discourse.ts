import type { Env, QueueMessage } from '../types';
import { getCursor, setCursor } from '../lib/cursor';

const BASE_URL = 'https://community.cloudflare.com';

interface DiscourseTopic {
  id: number;
  title: string;
  slug: string;
  created_at: string;
  posts_count: number;
  like_count: number;
  views: number;
  posters: Array<{ user_id: number; description: string }>;
}

interface DiscourseLatest {
  topic_list: {
    topics: DiscourseTopic[];
  };
  users?: Array<{ id: number; username: string }>;
}

interface DiscourseTopicDetail {
  post_stream?: {
    posts?: Array<{
      cooked: string;
      username: string;
    }>;
  };
}

interface DiscourseCursor {
  last_topic_id: string;
}

export async function scrapeDiscourse(env: Env): Promise<number> {
  const cursorKey = 'cursor:discourse';
  const cursor = await getCursor<DiscourseCursor>(env.INGRESS_STATE, cursorKey);
  const lastTopicId = cursor ? parseInt(cursor.last_topic_id, 10) : 0;

  const response = await fetch(`${BASE_URL}/latest.json`, {
    headers: {
      'User-Agent': 'cf-feedback-aggregator',
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    console.error(`Discourse: HTTP ${response.status}`);
    return 0;
  }

  const data = (await response.json()) as DiscourseLatest;
  const topics = data.topic_list.topics;
  const userMap = new Map(
    (data.users || []).map((u) => [u.id, u.username]),
  );

  const newTopics = topics.filter((t) => t.id > lastTopicId);
  if (newTopics.length === 0) {
    console.log('Discourse: no new topics');
    return 0;
  }

  let enqueued = 0;

  for (const topic of newTopics.slice(0, 20)) {
    // Fetch topic detail for the body (rate-limited)
    let body = '';
    let author = 'unknown';
    try {
      const detailResp = await fetch(`${BASE_URL}/t/${topic.id}.json`, {
        headers: {
          'User-Agent': 'cf-feedback-aggregator',
          'Accept': 'application/json',
        },
      });
      if (detailResp.ok) {
        const detail = (await detailResp.json()) as DiscourseTopicDetail;
        const firstPost = detail.post_stream?.posts?.[0];
        if (firstPost) {
          // Strip HTML tags from cooked content
          body = firstPost.cooked.replace(/<[^>]*>/g, '').slice(0, 2000);
          author = firstPost.username;
        }
      }
    } catch (e) {
      console.error(`Discourse: failed to fetch topic ${topic.id}:`, e);
    }

    if (!author || author === 'unknown') {
      const firstPoster = topic.posters?.[0];
      if (firstPoster) {
        author = userMap.get(firstPoster.user_id) || 'unknown';
      }
    }

    const msg: QueueMessage = {
      source: 'discourse',
      source_id: `discourse-${topic.id}`,
      source_url: `${BASE_URL}/t/${topic.slug}/${topic.id}`,
      title: topic.title,
      body,
      author,
      created_at: topic.created_at,
      upvotes: topic.like_count || 0,
      comment_count: (topic.posts_count || 1) - 1,
      view_count: topic.views || 0,
      metadata: {
        slug: topic.slug,
      },
    };

    await env.FEEDBACK_QUEUE.send(msg);
    enqueued++;
  }

  // Update cursor to highest topic ID seen
  const maxId = Math.max(...newTopics.map((t) => t.id));
  await setCursor(env.INGRESS_STATE, cursorKey, {
    last_topic_id: maxId.toString(),
  });

  console.log(`Discourse: enqueued ${enqueued} topics`);
  return enqueued;
}
