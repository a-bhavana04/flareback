import type { Env, QueueMessage } from '../types';

const PROMPT = `Generate 5 realistic tweets about Cloudflare products as if from real developers and users. Each tweet must sound authentic—use casual language, occasional hashtags (#Cloudflare #Serverless #WebDev), and specific technical details.

Requirements:
- Each tweet from a different fictional user with a realistic handle (e.g. dev_sarah, cloud_ops_mike, startup_cto)
- Mix: 1 positive experience, 1 complaint about a real pain point, 1 feature request with specifics, 1 question, 1 mixed/neutral
- Include concrete details: product names (Workers, Pages, D1, R2, KV, WARP), error codes, cold start times, pricing, etc.
- Vary format: some with hashtags, some thread-style, some direct feedback
- Max 280 chars per tweet

Respond with ONLY a JSON array (no markdown). Each object:
- username: Twitter handle (no @)
- text: tweet (max 280 chars)
- likes: 0-500
- retweets: 0-100
- sentiment_hint: "positive"|"negative"|"neutral"|"mixed"`;

export async function generateMockTweets(env: Env): Promise<number> {
  try {
    const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct-fp8', {
      messages: [{ role: 'user', content: PROMPT }],
      max_tokens: 1000,
    });

    const text = (response as { response?: string }).response || '';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error('Mock Twitter: failed to parse AI response');
      return 0;
    }

    const tweets = JSON.parse(jsonMatch[0]) as Array<{
      username: string;
      text: string;
      likes: number;
      retweets: number;
      sentiment_hint: string;
    }>;

    let enqueued = 0;
    for (const tweet of tweets) {
      const id = `tweet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const msg: QueueMessage = {
        source: 'twitter_mock',
        source_id: id,
        source_url: `https://x.com/${tweet.username}/status/${id}`,
        title: undefined,
        body: tweet.text.slice(0, 280),
        author: tweet.username,
        created_at: new Date().toISOString(),
        upvotes: tweet.likes || 0,
        metadata: {
          retweets: tweet.retweets || 0,
          sentiment_hint: tweet.sentiment_hint,
          is_mock: true,
        },
      };

      await env.FEEDBACK_QUEUE.send(msg);
      enqueued++;
    }

    console.log(`Mock Twitter: enqueued ${enqueued} tweets`);
    return enqueued;
  } catch (e) {
    console.error('Mock Twitter generation failed:', e);
    return 0;
  }
}
