import type { Env, QueueMessage } from './types';
import { computeHash, isDuplicate, markSeen } from './lib/dedup';
import { enrichFeedback } from './lib/ai';
import { shouldSkipContent } from './lib/skip-filter';

interface ProcessedItem {
  id: string;
  msg: QueueMessage;
  hash: string;
  enrichment: Awaited<ReturnType<typeof enrichFeedback>>;
}

export async function handleQueue(
  batch: MessageBatch<QueueMessage>,
  env: Env,
): Promise<void> {
  const toInsert: ProcessedItem[] = [];

  // Phase 1: Dedup check + AI enrichment for each message
  for (const message of batch.messages) {
    const msg = message.body;

    try {
      const contentForHash = `${msg.source}:${msg.title || ''}:${(msg.body || '').slice(0, 500)}`;
      const hash = await computeHash(contentForHash);

      if (await isDuplicate(env.INGRESS_STATE, hash)) {
        console.log(`Dedup: skipping ${msg.source}/${msg.source_id}`);
        message.ack();
        continue;
      }

      if (shouldSkipContent(msg.title, msg.body)) {
        console.log(`Skip filter: skipping noise ${msg.source}/${msg.source_id}`);
        message.ack();
        continue;
      }

      const enrichment = await enrichFeedback(env.AI, msg.title, msg.body, msg.source);

      if (enrichment.category === 'skip') {
        console.log(`AI skip: not substantive feedback ${msg.source}/${msg.source_id}`);
        message.ack();
        continue;
      }
      const id = await computeHash(`${msg.source}:${msg.source_id}`);

      toInsert.push({ id, msg, hash, enrichment });
      message.ack();
    } catch (e) {
      console.error(`Failed to process ${msg.source}/${msg.source_id}:`, e);
      message.retry();
    }
  }

  if (toInsert.length === 0) return;

  // Phase 2: Batch D1 insert (inspired by crowd.dev's batch processor pattern)
  const stmts = toInsert.map((item) =>
    env.DB.prepare(
      `INSERT OR IGNORE INTO feedback_items
       (id, source, source_id, source_url, title, body, author, created_at,
        upvotes, comment_count, view_count, sentiment, sentiment_score,
        category, product, priority, metadata, content_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      item.id,
      item.msg.source,
      item.msg.source_id,
      item.msg.source_url || null,
      item.msg.title || null,
      (item.msg.body || '').slice(0, 2000) || null,
      item.msg.author || null,
      item.msg.created_at,
      item.msg.upvotes || 0,
      item.msg.comment_count || 0,
      item.msg.view_count || 0,
      item.enrichment.sentiment,
      item.enrichment.sentiment_score,
      item.enrichment.category,
      item.enrichment.product,
      item.enrichment.priority,
      item.msg.metadata ? JSON.stringify(item.msg.metadata) : null,
      item.hash,
    ),
  );

  // D1 batch API — single round-trip for all inserts
  await env.DB.batch(stmts);

  // Phase 3: Mark all as seen for dedup
  await Promise.all(
    toInsert.map((item) => markSeen(env.INGRESS_STATE, item.hash)),
  );

  console.log(`Batch processed ${toInsert.length} items: ${toInsert.map((i) => `${i.msg.source}/${i.msg.source_id}`).join(', ')}`);
}
