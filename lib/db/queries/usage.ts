import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { type UsageLogRow, usageLogs } from "@/lib/db/schema";

export type UsageFeature = UsageLogRow["feature"];

export interface InsertUsageLogInput {
  id: string;
  model: string;
  provider?: string | null;
  feature: UsageFeature;
  conversationId?: string | null;
  meetingId?: string | null;
  imageId?: string | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
  reasoningTokens?: number | null;
  cachedTokens?: number | null;
  totalTokens?: number | null;
  costUsd?: number | null;
  generationId?: string | null;
  createdAt?: Date;
}

export function insertUsageLog(input: InsertUsageLogInput): void {
  db.insert(usageLogs)
    .values({
      id: input.id,
      model: input.model,
      provider: input.provider ?? null,
      feature: input.feature,
      conversationId: input.conversationId ?? null,
      meetingId: input.meetingId ?? null,
      imageId: input.imageId ?? null,
      promptTokens: input.promptTokens ?? null,
      completionTokens: input.completionTokens ?? null,
      reasoningTokens: input.reasoningTokens ?? null,
      cachedTokens: input.cachedTokens ?? null,
      totalTokens: input.totalTokens ?? null,
      costUsd: input.costUsd ?? null,
      generationId: input.generationId ?? null,
      createdAt: input.createdAt ?? new Date(),
    })
    .run();
}

/** Patch cost on a row once the generation-cost lookup resolves. */
export function setUsageLogCost(id: string, costUsd: number): void {
  db.update(usageLogs)
    .set({ costUsd })
    .where(eq(usageLogs.id, id))
    .run();
}

export interface UsageListOptions {
  since?: Date;
  feature?: UsageFeature;
  limit?: number;
}

export function listUsageLogs({
  since,
  feature,
  limit = 1000,
}: UsageListOptions = {}): UsageLogRow[] {
  const filters = [];
  if (since) filters.push(gte(usageLogs.createdAt, since));
  if (feature) filters.push(eq(usageLogs.feature, feature));
  return db
    .select()
    .from(usageLogs)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(usageLogs.createdAt))
    .limit(limit)
    .all();
}

export interface UsageTotals {
  totalCostUsd: number;
  totalTokens: number;
  count: number;
}

export function getUsageTotals(since?: Date): UsageTotals {
  const row = db
    .select({
      totalCostUsd: sql<number>`coalesce(sum(${usageLogs.costUsd}), 0)`,
      totalTokens: sql<number>`coalesce(sum(${usageLogs.totalTokens}), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(usageLogs)
    .where(since ? gte(usageLogs.createdAt, since) : undefined)
    .get();
  return (
    row ?? { totalCostUsd: 0, totalTokens: 0, count: 0 }
  );
}

export interface UsageByKey {
  key: string;
  costUsd: number;
  totalTokens: number;
  count: number;
}

/** Aggregate spend/tokens grouped by model. */
export function getUsageByModel(since?: Date): UsageByKey[] {
  return db
    .select({
      key: usageLogs.model,
      costUsd: sql<number>`coalesce(sum(${usageLogs.costUsd}), 0)`,
      totalTokens: sql<number>`coalesce(sum(${usageLogs.totalTokens}), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(usageLogs)
    .where(since ? gte(usageLogs.createdAt, since) : undefined)
    .groupBy(usageLogs.model)
    .orderBy(desc(sql`coalesce(sum(${usageLogs.costUsd}), 0)`))
    .all();
}

/** Aggregate spend/tokens grouped by feature. */
export function getUsageByFeature(since?: Date): UsageByKey[] {
  return db
    .select({
      key: usageLogs.feature,
      costUsd: sql<number>`coalesce(sum(${usageLogs.costUsd}), 0)`,
      totalTokens: sql<number>`coalesce(sum(${usageLogs.totalTokens}), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(usageLogs)
    .where(since ? gte(usageLogs.createdAt, since) : undefined)
    .groupBy(usageLogs.feature)
    .all();
}

export interface UsageDailyPoint {
  /** ISO date (YYYY-MM-DD, local) */
  day: string;
  costUsd: number;
  totalTokens: number;
}

/** Daily spend/token buckets for the area chart. */
export function getUsageDaily(since?: Date): UsageDailyPoint[] {
  // created_at is timestamp_ms; convert to local day string
  const dayExpr = sql<string>`date(${usageLogs.createdAt} / 1000, 'unixepoch', 'localtime')`;
  return db
    .select({
      day: dayExpr,
      costUsd: sql<number>`coalesce(sum(${usageLogs.costUsd}), 0)`,
      totalTokens: sql<number>`coalesce(sum(${usageLogs.totalTokens}), 0)`,
    })
    .from(usageLogs)
    .where(since ? gte(usageLogs.createdAt, since) : undefined)
    .groupBy(dayExpr)
    .orderBy(dayExpr)
    .all();
}
