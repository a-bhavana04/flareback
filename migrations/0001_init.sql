-- Initial schema for feedback aggregation
CREATE TABLE IF NOT EXISTS feedback_items (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  source_id TEXT NOT NULL,
  source_url TEXT,
  title TEXT,
  body TEXT,
  author TEXT,
  created_at TEXT NOT NULL,
  ingested_at TEXT NOT NULL DEFAULT (datetime('now')),
  upvotes INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  sentiment TEXT,
  sentiment_score REAL,
  category TEXT,
  product TEXT,
  priority TEXT,
  metadata TEXT,
  content_hash TEXT,
  UNIQUE(source, source_id)
);

CREATE INDEX IF NOT EXISTS idx_source ON feedback_items(source);
CREATE INDEX IF NOT EXISTS idx_created ON feedback_items(created_at);
CREATE INDEX IF NOT EXISTS idx_sentiment ON feedback_items(sentiment);
CREATE INDEX IF NOT EXISTS idx_category ON feedback_items(category);
CREATE INDEX IF NOT EXISTS idx_product ON feedback_items(product);
