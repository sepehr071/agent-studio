"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { UsageByKey, UsageDailyPoint } from "@/lib/db/queries";

/** Persian labels for the latin feature enum. */
export const FEATURE_LABELS: Record<string, string> = {
  chat: "گفتگو",
  image: "تصویر",
  meeting: "جلسه",
  enhancer: "بهبود پرامپت",
  title: "عنوان‌گذاری",
};

/**
 * Single source for the chart accent ramp — azure, violet, teal, amber, rose.
 * The donut and per-model bars cycle it; the spend area reads its first slot.
 */
export const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

const usd = (n: number) => `$${n.toFixed(n < 1 ? 4 : 2)}`;

/** Short month/day label for the 30-day axis (e.g. "06/04"). */
function shortDay(iso: string): string {
  const [, m, d] = iso.split("-");
  return m && d ? `${m}/${d}` : iso;
}

// ----------------------------------------------------------- spend over time

export function SpendAreaChart({ data }: { data: UsageDailyPoint[] }) {
  // Spend keeps the azure slot (chart-1), read from the shared ramp.
  const azure = CHART_COLORS[0];
  const config = {
    costUsd: { label: "هزینه", color: azure },
  } satisfies ChartConfig;

  return (
    // Fixed height — aspect-based sizing balloons on wide viewports
    // LTR SVG so the right-hand axis labels anchor outside the plot area
    <ChartContainer
      className="aspect-auto h-[280px] w-full"
      config={config}
      dir="ltr"
    >
      <AreaChart data={data} margin={{ left: 4, right: 12, top: 8 }}>
        <defs>
          <linearGradient id="usage-spend" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={azure} stopOpacity={0.35} />
            <stop offset="100%" stopColor={azure} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
        <XAxis
          axisLine={false}
          dataKey="day"
          fontSize={11}
          reversed
          tickFormatter={shortDay}
          tickLine={false}
          tickMargin={8}
        />
        <YAxis
          axisLine={false}
          fontSize={11}
          orientation="right"
          tickFormatter={(v: number) => usd(v)}
          tickLine={false}
          width={56}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => (
                <span className="font-mono" dir="ltr">
                  {usd(Number(value))}
                </span>
              )}
              labelFormatter={(label) => shortDay(String(label))}
            />
          }
        />
        <Area
          dataKey="costUsd"
          fill="url(#usage-spend)"
          stroke={azure}
          strokeWidth={2}
          type="monotone"
        />
      </AreaChart>
    </ChartContainer>
  );
}

// ----------------------------------------------------------- per-model bar

export function ModelBarChart({ data }: { data: UsageByKey[] }) {
  // Recharts renders LTR; keep model ids latin & readable on the axis
  const rows = data.map((d) => ({
    model: d.key,
    short: d.key.split("/").pop() ?? d.key,
    costUsd: d.costUsd,
  }));

  const config = {
    costUsd: { label: "هزینه", color: CHART_COLORS[1] },
  } satisfies ChartConfig;

  return (
    <ChartContainer
      className="aspect-auto w-full"
      config={config}
      // LTR SVG + reversed X axis: bars grow leftward from the right-hand
      // labels (RTL reading order) without the labels overlapping the bars.
      dir="ltr"
      style={{ height: Math.max(160, rows.length * 34) }}
    >
      <BarChart
        data={rows}
        layout="vertical"
        margin={{ left: 16, right: 8 }}
      >
        <CartesianGrid horizontal={false} stroke="var(--chart-grid)" />
        <XAxis
          axisLine={false}
          fontSize={11}
          reversed
          tickFormatter={(v: number) => usd(v)}
          tickLine={false}
          type="number"
        />
        <YAxis
          axisLine={false}
          dataKey="short"
          fontSize={10}
          orientation="right"
          tickLine={false}
          type="category"
          width={120}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, _name, item) => (
                <div className="flex flex-col gap-0.5" dir="ltr">
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {item?.payload?.model}
                  </span>
                  <span className="font-mono">{usd(Number(value))}</span>
                </div>
              )}
              hideLabel
            />
          }
        />
        <Bar dataKey="costUsd" radius={4}>
          {rows.map((row, i) => (
            <Cell
              fill={CHART_COLORS[i % CHART_COLORS.length]}
              key={row.model}
            />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

// ----------------------------------------------------------- per-feature donut

export function FeatureDonutChart({ data }: { data: UsageByKey[] }) {
  const rows = data.map((d, i) => ({
    feature: d.key,
    label: FEATURE_LABELS[d.key] ?? d.key,
    costUsd: d.costUsd,
    count: d.count,
    fill: CHART_COLORS[i % CHART_COLORS.length],
  }));

  // Donut by cost; fall back to request count when all costs are zero
  const hasCost = rows.some((r) => r.costUsd > 0);
  const valueKey = hasCost ? "costUsd" : "count";

  const config: ChartConfig = Object.fromEntries(
    rows.map((r) => [r.feature, { label: r.label, color: r.fill }]),
  );

  return (
    <ChartContainer
      className="mx-auto aspect-auto h-64 w-full max-w-80"
      config={config}
    >
      <PieChart>
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, name) => (
                <span>
                  {FEATURE_LABELS[String(name)] ?? String(name)}:{" "}
                  {hasCost ? (
                    <span className="font-mono" dir="ltr">
                      {usd(Number(value))}
                    </span>
                  ) : (
                    `${value} درخواست`
                  )}
                </span>
              )}
              hideLabel
              nameKey="feature"
            />
          }
        />
        <Pie
          data={rows}
          dataKey={valueKey}
          innerRadius="55%"
          nameKey="feature"
          outerRadius="80%"
          paddingAngle={2}
          strokeWidth={0}
        >
          {rows.map((r) => (
            <Cell fill={r.fill} key={r.feature} />
          ))}
        </Pie>
      </PieChart>
    </ChartContainer>
  );
}
