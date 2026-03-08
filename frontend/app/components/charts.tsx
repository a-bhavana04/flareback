"use client";

import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface CountRow {
  label: string;
  count: number;
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

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface border border-border rounded-lg px-3 py-2 text-xs font-mono shadow-xl">
      <p className="text-foreground font-medium">{label || payload[0]?.name}</p>
      <p className="text-accent mt-0.5">{payload[0]?.value?.toLocaleString()}</p>
    </div>
  );
};

export function SourcePieChart({ data }: { data: CountRow[] }) {
  return (
    <div className="h-[240px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data.map((r) => ({ name: r.label, value: r.count }))}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={85}
            dataKey="value"
            stroke="transparent"
            strokeWidth={0}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={SOURCE_COLORS[i % SOURCE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SentimentPieChart({ data }: { data: CountRow[] }) {
  return (
    <div className="h-[240px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data.map((r) => ({ name: r.label, value: r.count }))}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={85}
            dataKey="value"
            stroke="transparent"
            strokeWidth={0}
          >
            {data.map((row, i) => (
              <Cell key={i} fill={SENTIMENT_MAP[row.label] || "#6b7280"} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ProductBarChart({ data }: { data: CountRow[] }) {
  return (
    <div className="h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data.slice(0, 12).map((r) => ({ name: r.label, count: r.count }))}
          margin={{ top: 8, right: 8, bottom: 60, left: -12 }}
        >
          <XAxis
            dataKey="name"
            tick={{ fill: "#71717a", fontSize: 10, fontFamily: "JetBrains Mono" }}
            angle={-45}
            textAnchor="end"
            axisLine={{ stroke: "#27272a" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#71717a", fontSize: 10, fontFamily: "JetBrains Mono" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f9731610" }} />
          <Bar
            dataKey="count"
            fill="#f97316"
            radius={[3, 3, 0, 0]}
            maxBarSize={40}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ChartLegend({
  items,
  colors,
}: {
  items: CountRow[];
  colors: Record<string, string> | string[];
}) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-4">
      {items.map((item, i) => {
        const color = Array.isArray(colors)
          ? colors[i % colors.length]
          : colors[item.label] || "#6b7280";
        return (
          <div key={item.label} className="flex items-center gap-1.5 text-[11px]">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: color }}
            />
            <span className="text-muted">{item.label}</span>
            <span className="text-foreground font-medium">{item.count}</span>
          </div>
        );
      })}
    </div>
  );
}
