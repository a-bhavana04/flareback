import type { Env, QueueMessage } from '../types';
import { getCursor, setCursor } from '../lib/cursor';

const CURSOR_KEY = 'cursor:discord';
const GUILD_ID = '1479584172006703124';

interface DiscordChannel {
  id: string;
  name: string;
  type: number;
}

interface DiscordMessage {
  id: string;
  content: string;
  author: { id: string; username: string; bot?: boolean };
  timestamp: string;
  reactions?: Array<{ count: number; emoji: { name: string } }>;
  thread?: { id: string; name: string; message_count: number };
  referenced_message?: { id: string } | null;
}

async function getTextChannels(env: Env): Promise<DiscordChannel[]> {
  const response = await fetch(`https://discord.com/api/v10/guilds/${GUILD_ID}/channels`, {
    headers: {
      'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`,
      'User-Agent': 'cf-feedback-aggregator',
    },
  });

  if (!response.ok) {
    console.error(`Discord: failed to fetch channels (HTTP ${response.status})`);
    return [];
  }

  const channels = (await response.json()) as DiscordChannel[];
  // type 0 = text channel
  return channels.filter((c) => c.type === 0);
}

export async function scrapeDiscord(env: Env): Promise<number> {
  if (!env.DISCORD_BOT_TOKEN) {
    console.log('Discord: no bot token configured, skipping');
    return 0;
  }

  const channels = await getTextChannels(env);
  if (channels.length === 0) return 0;

  let totalEnqueued = 0;

  for (const channel of channels) {
    const cursorKey = `${CURSOR_KEY}:${channel.id}`;
    const cursor = await getCursor<{ last_message_id: string }>(env.INGRESS_STATE, cursorKey);

    const params = new URLSearchParams({ limit: '100' });
    if (cursor?.last_message_id) {
      params.set('after', cursor.last_message_id);
    }

    const url = `https://discord.com/api/v10/channels/${channel.id}/messages?${params}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`,
        'User-Agent': 'cf-feedback-aggregator',
      },
    });

    if (response.status === 403 || response.status === 401) {
      console.error(`Discord: unauthorized for channel ${channel.name}`);
      continue;
    }

    if (response.status === 429) {
      const retryAfter = response.headers.get('retry-after');
      console.error(`Discord: rate limited on ${channel.name}, retry after ${retryAfter}s`);
      continue;
    }

    if (!response.ok) {
      console.error(`Discord: HTTP ${response.status} for ${channel.name}`);
      continue;
    }

    const messages = (await response.json()) as DiscordMessage[];

    if (messages.length === 0) continue;

    const queueMessages: QueueMessage[] = [];

    for (const msg of messages) {
      // Skip bot messages and very short messages
      if (msg.author.bot || !msg.content || msg.content.length < 5) continue;

      const totalReactions = (msg.reactions || []).reduce((sum, r) => sum + r.count, 0);

      queueMessages.push({
        source: 'discord',
        source_id: `discord-${msg.id}`,
        source_url: `https://discord.com/channels/${GUILD_ID}/${channel.id}/${msg.id}`,
        title: msg.thread?.name || undefined,
        body: msg.content.slice(0, 2000),
        author: msg.author.username,
        created_at: msg.timestamp,
        upvotes: totalReactions,
        comment_count: msg.thread?.message_count || 0,
        metadata: {
          channel: channel.name,
          channel_id: channel.id,
          guild_id: GUILD_ID,
          has_thread: !!msg.thread,
          is_reply: !!msg.referenced_message,
        },
      });
    }

    if (queueMessages.length > 0) {
      await env.FEEDBACK_QUEUE.sendBatch(
        queueMessages.map((m) => ({ body: m })),
      );
    }

    // Discord returns newest first, so first element has highest ID
    const maxId = messages[0].id;
    await setCursor(env.INGRESS_STATE, cursorKey, { last_message_id: maxId });

    totalEnqueued += queueMessages.length;
    console.log(`Discord #${channel.name}: enqueued ${queueMessages.length} messages`);
  }

  return totalEnqueued;
}
