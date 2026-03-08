import Link from "next/link";
import { FilterSelect } from "./filter-nav";

const API =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://cf-feedback-aggregator.banand.workers.dev";

interface FeedbackItem {
  id: string;
  source: string;
  title: string | null;
  body: string | null;
  author: string | null;
  created_at: string;
  sentiment: string | null;
  category: string | null;
  product: string | null;
  priority: string | null;
  upvotes: number;
  comment_count: number;
  source_url: string | null;
  metadata?: string | Record<string, unknown>;
}

interface FeedMeta {
  limit: number;
  offset: number;
  count: number;
}

const CATEGORY_STYLES: Record<string, string> = {
  bug: "bg-red-500/15 text-red-400 border-red-500/25",
  "feature-request": "bg-blue-500/15 text-blue-400 border-blue-500/25",
  question: "bg-purple-500/15 text-purple-400 border-purple-500/25",
  praise: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  complaint: "bg-orange-500/15 text-orange-400 border-orange-500/25",
};

const SENTIMENT_DOT: Record<string, string> = {
  positive: "bg-positive",
  negative: "bg-negative",
  mixed: "bg-mixed",
  neutral: "bg-neutral-tone",
};

const PRIORITY_STYLES: Record<string, string> = {
  critical: "bg-red-500/20 text-red-400 border-red-500/30",
  high: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  low: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
};

const LIMIT = 20;

export const dynamic = "force-dynamic";

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const source = (params.source as string) || "";
  const sentiment = (params.sentiment as string) || "";
  const category = (params.category as string) || "";
  const product = (params.product as string) || "";
  const page = Math.max(1, parseInt((params.page as string) || "1", 10));
  const offset = (page - 1) * LIMIT;

  const qs = new URLSearchParams();
  qs.set("limit", String(LIMIT));
  qs.set("offset", String(offset));
  if (source) qs.set("source", source);
  if (sentiment) qs.set("sentiment", sentiment);
  if (category) qs.set("category", category);
  if (product) qs.set("product", product);

  const [feedRes, statsRes] = await Promise.all([
    fetch(`${API}/api/feedback?${qs}`, { cache: "no-store" }),
    fetch(`${API}/api/stats`, { cache: "no-store" }),
  ]);

  const feed = await feedRes.json();
  const stats = await statsRes.json();
  const items: FeedbackItem[] = feed.data;
  const meta: FeedMeta = feed.meta;

  const sources = Object.keys(stats.by_source || {}).sort();
  const sentiments = Object.keys(stats.by_sentiment || {}).sort();
  const categories = Object.keys(stats.by_category || {}).sort();
  const products = Object.keys(stats.by_product || {}).sort();

  const totalPages = Math.ceil(meta.count / LIMIT);

  function buildUrl(overrides: Record<string, string>) {
    const p = new URLSearchParams();
    const merged = { source, sentiment, category, product, page: String(page), ...overrides };
    for (const [k, v] of Object.entries(merged)) {
      if (v && v !== "0") p.set(k, v);
    }
    if (!overrides.page) p.set("page", "1");
    return `/feed?${p}`;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="animate-slide-up" style={{ animationDelay: "0ms" }}>
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight font-[family-name:var(--font-display)]">
              Feed
            </h1>
            <p className="text-[12px] text-muted mt-1 tracking-wide">
              <span className="text-foreground font-medium">
                {meta.count.toLocaleString()}
              </span>{" "}
              items
              {(source || sentiment || category || product) && (
                <span className="text-accent"> (filtered)</span>
              )}
            </p>
          </div>
          <Link
            href="/"
            className="text-[11px] text-accent hover:text-accent/80 tracking-wider uppercase transition-colors"
          >
            &larr; Dashboard
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div
        className="animate-slide-up flex flex-wrap items-end gap-3"
        style={{ animationDelay: "60ms" }}
      >
        <FilterSelect label="Source" param="source" options={sources} value={source} />
        <FilterSelect label="Sentiment" param="sentiment" options={sentiments} value={sentiment} />
        <FilterSelect label="Category" param="category" options={categories} value={category} />
        <FilterSelect label="Product" param="product" options={products} value={product} />
        {(source || sentiment || category || product) && (
          <a
            href="/feed"
            className="text-[10px] text-muted hover:text-negative tracking-wider uppercase transition-colors px-2 py-1.5"
          >
            Clear all
          </a>
        )}
      </div>

      {/* Feed Items */}
      <div
        className="space-y-1.5 animate-slide-up"
        style={{ animationDelay: "120ms" }}
      >
        {items.length === 0 ? (
          <div className="text-center py-16 text-muted text-sm">
            No feedback items match your filters.
          </div>
        ) : (
          items.map((item) => <FeedCard key={item.id} item={item} />)
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div
          className="flex items-center justify-center gap-1 animate-slide-up"
          style={{ animationDelay: "180ms" }}
        >
          {page > 1 && (
            <PaginationLink href={buildUrl({ page: String(page - 1) })}>
              &larr; Prev
            </PaginationLink>
          )}
          {paginationRange(page, totalPages).map((p, i) =>
            p === "..." ? (
              <span
                key={`ellipsis-${i}`}
                className="px-2 text-[11px] text-muted"
              >
                ...
              </span>
            ) : (
              <PaginationLink
                key={p}
                href={buildUrl({ page: String(p) })}
                active={p === page}
              >
                {p}
              </PaginationLink>
            )
          )}
          {page < totalPages && (
            <PaginationLink href={buildUrl({ page: String(page + 1) })}>
              Next &rarr;
            </PaginationLink>
          )}
        </div>
      )}
    </div>
  );
}

function FeedCard({ item }: { item: FeedbackItem }) {
  return (
    <div className="group flex items-start gap-3 p-4 bg-surface rounded-lg border border-border hover:border-border-hover transition-all duration-200">
      {/* Left: sentiment + source */}
      <div className="flex flex-col items-center gap-1 pt-0.5 shrink-0 w-14">
        <span
          className={`w-2 h-2 rounded-full ${
            SENTIMENT_DOT[item.sentiment || ""] || "bg-neutral-tone"
          }`}
        />
        <span className="text-[9px] text-muted uppercase tracking-widest text-center leading-tight">
          {item.source.replace("_mock", "")}
        </span>
      </div>

      {/* Center: content */}
      <div className="min-w-0 flex-1">
        {item.title ? (
          <p className="text-[13px] font-medium leading-snug">
            {item.source_url ? (
              <a
                href={item.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-accent transition-colors"
              >
                {item.title}
              </a>
            ) : (
              item.title
            )}
          </p>
        ) : null}
        {item.body && (
          <p className="text-[11px] text-muted mt-1 leading-relaxed line-clamp-2">
            {item.body.slice(0, 300)}
          </p>
        )}

        {/* Badges */}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {item.source === "hackernews" && (() => {
            let meta: Record<string, unknown> = {};
            try {
              meta = typeof item.metadata === "string" ? JSON.parse(item.metadata || "{}") : (item.metadata as Record<string, unknown>) || {};
            } catch {
              meta = {};
            }
            const ref = meta.cloudflare_reference as string | undefined;
            const refLabel = ref === "story_title" ? "CF in title" : ref === "story_body" ? "CF in article" : ref === "comment" ? "CF in comment" : ref ? `CF: ${ref}` : null;
            return refLabel ? (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium tracking-wider uppercase">
                {refLabel}
              </span>
            ) : null;
          })()}
          {item.category && (
            <span
              className={`text-[9px] px-1.5 py-0.5 rounded border font-medium tracking-wider uppercase ${
                CATEGORY_STYLES[item.category] ||
                "bg-surface-2 text-muted border-border"
              }`}
            >
              {item.category}
            </span>
          )}
          {item.product &&
            item.product !== "Unknown" &&
            item.product !== "General" && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent/10 text-accent border border-accent/20 font-medium tracking-wider uppercase">
                {item.product}
              </span>
            )}
          {item.priority && (
            <span
              className={`text-[9px] px-1.5 py-0.5 rounded border font-medium tracking-wider uppercase ${
                PRIORITY_STYLES[item.priority] ||
                "bg-surface-2 text-muted border-border"
              }`}
            >
              {item.priority}
            </span>
          )}
          {item.upvotes > 0 && (
            <span className="text-[10px] text-muted tabular-nums">
              +{item.upvotes}
            </span>
          )}
          {item.comment_count > 0 && (
            <span className="text-[10px] text-muted tabular-nums">
              {item.comment_count} comments
            </span>
          )}
        </div>
      </div>

      {/* Right: meta */}
      <div className="shrink-0 text-right flex flex-col items-end gap-1">
        {item.author && (
          <span className="text-[10px] text-muted truncate max-w-[100px]">
            {item.author}
          </span>
        )}
        <span className="text-[10px] text-muted tabular-nums">
          {new Date(item.created_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      </div>
    </div>
  );
}

function PaginationLink({
  href,
  active,
  children,
}: {
  href: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className={`px-3 py-1.5 text-[11px] rounded border transition-all duration-200 tracking-wider ${
        active
          ? "bg-accent/15 text-accent border-accent/30 font-medium"
          : "bg-surface text-muted border-border hover:border-border-hover hover:text-foreground"
      }`}
    >
      {children}
    </a>
  );
}

function paginationRange(
  current: number,
  total: number
): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "...")[] = [1];
  if (current > 3) pages.push("...");
  for (
    let i = Math.max(2, current - 1);
    i <= Math.min(total - 1, current + 1);
    i++
  ) {
    pages.push(i);
  }
  if (current < total - 2) pages.push("...");
  pages.push(total);
  return pages;
}
