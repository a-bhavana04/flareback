export interface Env {
  DB: D1Database;
  INGRESS_STATE: KVNamespace;
  FEEDBACK_QUEUE: Queue<QueueMessage>;
  AI: Ai;
  GITHUB_TOKEN: string;
  REDDIT_CLIENT_ID: string;
  REDDIT_CLIENT_SECRET: string;
  DISCORD_BOT_TOKEN: string;
}

export interface QueueMessage {
  source: 'github' | 'discourse' | 'reddit' | 'twitter_mock' | 'support_mock' | 'hackernews' | 'stackoverflow' | 'discord' | 'devto';
  source_id: string;
  source_url?: string;
  title?: string;
  body?: string;
  author?: string;
  created_at: string;
  upvotes?: number;
  comment_count?: number;
  view_count?: number;
  metadata?: Record<string, unknown>;
}

export interface FeedbackItem extends QueueMessage {
  id: string;
  ingested_at: string;
  sentiment?: string;
  sentiment_score?: number;
  category?: string;
  product?: string;
  priority?: string;
  content_hash?: string;
}

export interface AIEnrichment {
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
  sentiment_score: number;
  category: 'bug' | 'feature-request' | 'question' | 'praise' | 'complaint' | 'skip';
  product: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
}
