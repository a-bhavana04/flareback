import {
  SourcePieChart,
  SentimentPieChart,
  ProductBarChart,
  ChartLegend,
} from "./components/charts";

const API =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://cf-feedback-aggregator.banand.workers.dev";

interface StatsResponse {
  total: number;
  by_source: Record<string, number>;
  by_sentiment: Record<string, number>;
  by_category: Record<string, number>;
  by_product: Record<string, number>;
}

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

function toRows(obj: Record<string, number>) {
  return Object.entries(obj)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

const SOURCE_COLORS = [
  "#f97316", "#3b82f6", "#22c55e", "#ef4444",
  "#a855f7", "#eab308", "#ec4899", "#06b6d4", "#84cc16",
];

const SENTIMENT_MAP: Record<string, string> = {
  positive: "#22c55e",
  negative: "#ef4444",
  neutral: "#6b7280",
  mixed: "#eab308",
};

const CATEGORY_STYLES: Record<string, string> = {
  bug: "bg-red-500/15 text-red-400 border-red-500/25",
  "feature-request": "bg-blue-500/15 text-blue-400 border-blue-500/25",
  question: "bg-purple-500/15 text-purple-400 border-purple-500/25",
  praise: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  complaint: "bg-orange-500/15 text-orange-400 border-orange-500/25",
};

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const [statsRes, feedRes] = await Promise.all([
    fetch(`${API}/api/stats`, { cache: "no-store" }),
    fetch(`${API}/api/feedback?limit=8`, { cache: "no-store" }),
  ]);

  const stats: StatsResponse = await statsRes.json();
  const feed = await feedRes.json();
  const recent: FeedbackItem[] = feed.data;

  const bySource = toRows(stats.by_source);
  const bySentiment = toRows(stats.by_sentiment);
  const byCategory = toRows(stats.by_category);
  const byProduct = toRows(stats.by_product);

  const negCount = stats.by_sentiment["negative"] || 0;
  const negPct = stats.total > 0 ? ((negCount / stats.total) * 100).toFixed(1) : "0";
  const featureCount = stats.by_category["feature-request"] || 0;
  const bugCount = stats.by_category["bug"] || 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="animate-slide-up" style={{ animationDelay: "0ms" }}>
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight font-[family-name:var(--font-display)]">
              Dashboard
            </h1>
            <p className="text-[12px] text-muted mt-1 tracking-wide">
              Aggregating feedback from{" "}
              <span className="text-accent">{bySource.length}</span> sources
              &middot;{" "}
              <span className="text-foreground font-medium">
                {stats.total.toLocaleString()}
              </span>{" "}
              items processed
            </p>
          </div>
          <div className="text-[10px] text-muted tracking-widest uppercase">
            Live Data
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-positive ml-2 animate-pulse" />
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div
        className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-slide-up"
        style={{ animationDelay: "80ms" }}
      >
        <StatCard
          label="Total Feedback"
          value={stats.total.toLocaleString()}
          sub={`${bySource.length} sources`}
          accent
        />
        <StatCard
          label="Negative Sentiment"
          value={`${negPct}%`}
          sub={`${negCount} items`}
          warn={negCount > stats.total * 0.3}
        />
        <StatCard
          label="Feature Requests"
          value={featureCount.toLocaleString()}
          sub={`${stats.total > 0 ? ((featureCount / stats.total) * 100).toFixed(1) : 0}% of total`}
        />
        <StatCard
          label="Bug Reports"
          value={bugCount.toLocaleString()}
          sub={`${stats.total > 0 ? ((bugCount / stats.total) * 100).toFixed(1) : 0}% of total`}
          warn={bugCount > featureCount}
        />
      </div>

      {/* Charts Row */}
      <div
        className="grid lg:grid-cols-3 gap-3 animate-slide-up"
        style={{ animationDelay: "160ms" }}
      >
        <Panel title="Sources">
          <SourcePieChart data={bySource} />
          <ChartLegend items={bySource} colors={SOURCE_COLORS} />
        </Panel>

        <Panel title="Sentiment">
          <SentimentPieChart data={bySentiment} />
          <ChartLegend items={bySentiment} colors={SENTIMENT_MAP} />
        </Panel>

        <Panel title="Categories">
          <div className="space-y-2.5 mt-2">
            {byCategory.map((row) => (
              <div key={row.label}>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-muted">{row.label}</span>
                  <span className="text-foreground tabular-nums">
                    {row.count}{" "}
                    <span className="text-muted">
                      ({((row.count / stats.total) * 100).toFixed(0)}%)
                    </span>
                  </span>
                </div>
                <div className="h-1.5 bg-border rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full transition-all duration-700"
                    style={{
                      width: `${Math.max((row.count / stats.total) * 100, 2)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Product Bar Chart */}
      <div className="animate-slide-up" style={{ animationDelay: "240ms" }}>
        <Panel title="Feedback by Product">
          <ProductBarChart data={byProduct} />
        </Panel>
      </div>

      {/* Recent Feed */}
      <div className="animate-slide-up" style={{ animationDelay: "320ms" }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[13px] font-semibold tracking-tight font-[family-name:var(--font-display)]">
            Recent Feedback
          </h2>
          <a
            href="/feed"
            className="text-[11px] text-accent hover:text-accent/80 tracking-wider uppercase transition-colors"
          >
            View all &rarr;
          </a>
        </div>
        <div className="space-y-1.5">
          {recent.map((item) => (
            <FeedbackRow key={item.id} item={item} />
          ))}
        </div>
      </div>
    </div>
  );
}

function FeedbackRow({ item }: { item: FeedbackItem }) {
  return (
    <div className="group flex items-start gap-3 p-3.5 bg-surface rounded-lg border border-border hover:border-border-hover transition-all duration-200">
      <div className="flex flex-col items-center gap-1 pt-0.5">
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            item.sentiment === "positive"
              ? "bg-positive"
              : item.sentiment === "negative"
                ? "bg-negative"
                : item.sentiment === "mixed"
                  ? "bg-mixed"
                  : "bg-neutral-tone"
          }`}
        />
        <span className="text-[9px] text-muted uppercase tracking-widest">
          {item.source.replace("_mock", "")}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        {item.title ? (
          <p className="text-[12px] font-medium leading-snug line-clamp-2">
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
        ) : (
          <p className="text-[12px] text-muted leading-snug line-clamp-2">
            {item.body?.slice(0, 200)}
          </p>
        )}
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
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
              className={`text-[9px] px-1.5 py-0.5 rounded border font-medium tracking-wider uppercase ${CATEGORY_STYLES[item.category] || "bg-surface-2 text-muted border-border"}`}
            >
              {item.category}
            </span>
          )}
          {item.product && item.product !== "Unknown" && item.product !== "General" && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent/10 text-accent border border-accent/20 font-medium tracking-wider uppercase">
              {item.product}
            </span>
          )}
          <span className="text-[10px] text-muted ml-auto tabular-nums">
            {item.author && <span className="mr-2">{item.author}</span>}
            {new Date(item.created_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </span>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  accent,
  warn,
}: {
  label: string;
  value: string;
  sub: string;
  accent?: boolean;
  warn?: boolean;
}) {
  return (
    <div
      className={`relative p-4 rounded-lg border overflow-hidden transition-all duration-300 ${
        accent
          ? "bg-surface border-accent/30 glow-orange"
          : "bg-surface border-border hover:border-border-hover"
      }`}
    >
      {accent && (
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-accent to-transparent" />
      )}
      <p className="text-[10px] text-muted tracking-widest uppercase mb-2">
        {label}
      </p>
      <p
        className={`text-2xl font-bold tabular-nums tracking-tight ${
          warn ? "text-negative" : accent ? "text-accent" : "text-foreground"
        }`}
      >
        {value}
      </p>
      <p className="text-[10px] text-muted mt-1">{sub}</p>
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-surface rounded-lg border border-border p-5">
      <h2 className="text-[11px] text-muted tracking-widest uppercase mb-3">
        {title}
      </h2>
      {children}
    </div>
  );
}
