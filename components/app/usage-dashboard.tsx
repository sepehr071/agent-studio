"use client";

import {
  BarChart3Icon,
  CoinsIcon,
  CpuIcon,
  HashIcon,
  LayersIcon,
} from "lucide-react";
import {
  FEATURE_LABELS,
  FeatureDonutChart,
  ModelBarChart,
  SpendAreaChart,
} from "@/components/app/usage-charts";
import type {
  UsageByKey,
  UsageDailyPoint,
  UsageTotals,
} from "@/lib/db/queries";
import { chartTint } from "@/lib/tint";

function formatUsd(n: number): string {
  if (n === 0) return "$0.00";
  return `$${n < 1 ? n.toFixed(4) : n.toFixed(2)}`;
}

/** Group thousands with western digits, e.g. 12,345. */
function formatInt(n: number): string {
  return n.toLocaleString("en-US");
}

function shortModel(id: string | null): string {
  if (!id) return "—";
  return id.split("/").pop() ?? id;
}

function KpiTile({
  icon,
  label,
  value,
  tint,
  ltr,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  /** Chart-ramp slot for the icon hue + faint tile wash. */
  tint: 1 | 2 | 3 | 4 | 5;
  ltr?: boolean;
}) {
  const hue = chartTint(tint);
  return (
    <div
      className="glass flex flex-col gap-2 rounded-2xl p-4"
      // Faint identity wash keyed to the KPI's hue.
      style={{ background: `color-mix(in oklab, ${hue} 6%, var(--glass-bg))` }}
    >
      <div className="flex items-center gap-2 text-fg-3">
        <span
          className="relative grid size-7 place-items-center rounded-lg"
          style={{ background: `color-mix(in oklab, ${hue} 16%, transparent)` }}
        >
          <span style={{ color: hue }}>{icon}</span>
        </span>
        <span className="text-xs">{label}</span>
      </div>
      <p
        className={`font-bold font-heading text-fg-0 text-xl ${ltr ? "font-mono text-lg" : ""}`}
        dir={ltr ? "ltr" : undefined}
      >
        {value}
      </p>
    </div>
  );
}

function Panel({
  title,
  children,
  empty,
}: {
  title: string;
  children: React.ReactNode;
  empty: boolean;
}) {
  return (
    <section className="glass flex flex-col gap-3 rounded-2xl p-5">
      <h2 className="font-heading font-medium text-fg-1 text-sm">{title}</h2>
      {empty ? (
        <p className="py-10 text-center text-fg-4 text-xs">
          هنوز داده‌ای برای نمایش نیست
        </p>
      ) : (
        children
      )}
    </section>
  );
}

export function UsageDashboard({
  totals,
  byModel,
  byFeature,
  daily,
  topModel,
}: {
  totals: UsageTotals;
  byModel: UsageByKey[];
  byFeature: UsageByKey[];
  daily: UsageDailyPoint[];
  topModel: string | null;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="glass-strong sticky top-0 z-10 flex items-center gap-2 border-b px-6 py-4">
        <BarChart3Icon className="size-5 text-primary" />
        <h1 className="font-bold font-heading text-base text-foreground">
          آمار مصرف
        </h1>
      </header>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-6">
        {/* KPI tiles */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiTile
            icon={<CoinsIcon className="size-4" />}
            label="هزینه کل"
            ltr
            tint={4}
            value={formatUsd(totals.totalCostUsd)}
          />
          <KpiTile
            icon={<HashIcon className="size-4" />}
            label="توکن کل"
            tint={1}
            value={formatInt(totals.totalTokens)}
          />
          <KpiTile
            icon={<LayersIcon className="size-4" />}
            label="تعداد درخواست‌ها"
            tint={3}
            value={formatInt(totals.count)}
          />
          <KpiTile
            icon={<CpuIcon className="size-4" />}
            label="مدل پرکاربرد"
            ltr
            tint={2}
            value={shortModel(topModel)}
          />
        </div>

        {/* Spend over time */}
        <Panel empty={daily.length === 0} title="هزینه روزانه (۳۰ روز اخیر)">
          <SpendAreaChart data={daily} />
        </Panel>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Per-model cost */}
          <Panel
            empty={byModel.length === 0}
            title="هزینه به تفکیک مدل (۱۰ مورد برتر)"
          >
            <ModelBarChart data={byModel} />
          </Panel>

          {/* Per-feature donut */}
          <Panel
            empty={byFeature.length === 0}
            title="مصرف به تفکیک قابلیت"
          >
            <div className="flex flex-col items-center gap-4">
              <FeatureDonutChart data={byFeature} />
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5">
                {byFeature.map((f, i) => (
                  <div
                    className="flex items-center gap-1.5 text-fg-3 text-xs"
                    key={f.key}
                  >
                    <span
                      className="size-2.5 rounded-[2px]"
                      style={{ backgroundColor: `var(--chart-${(i % 5) + 1})` }}
                    />
                    {FEATURE_LABELS[f.key] ?? f.key}
                  </div>
                ))}
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
