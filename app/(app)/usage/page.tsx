import type { Metadata } from "next";
import { UsageDashboard } from "@/components/app/usage-dashboard";
import {
  getUsageByFeature,
  getUsageByModel,
  getUsageDaily,
  getUsageTotals,
} from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "آمار مصرف — استودیو",
};

const DAY_MS = 24 * 60 * 60 * 1000;

export default function UsagePage() {
  const since30 = new Date(Date.now() - 30 * DAY_MS);

  const totals = getUsageTotals();
  const byModel = getUsageByModel().slice(0, 10);
  const byFeature = getUsageByFeature();
  const daily = getUsageDaily(since30);

  // Most-used model (by request count, all-time)
  const topModel = [...byModel].sort((a, b) => b.count - a.count)[0]?.key ?? null;

  return (
    <UsageDashboard
      byFeature={byFeature}
      byModel={byModel}
      daily={daily}
      topModel={topModel}
      totals={totals}
    />
  );
}
