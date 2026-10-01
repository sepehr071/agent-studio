import { asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { type PromptTemplateRow, promptTemplates } from "@/lib/db/schema";
import { extractTemplateVariables } from "@/lib/templates";
import { SEED_TEMPLATES } from "@/lib/templates-seed";

export interface TemplateListOptions {
  category?: string;
}

/**
 * Idempotent seed of the curated Persian starter templates. Runs once on the
 * first templates read; `onConflictDoNothing` (stable ids) makes re-runs and
 * concurrent calls harmless. Stored with `isSeed: true` so they're visible as
 * built-ins.
 */
export function seedTemplatesOnce(): void {
  const existing = db
    .select({ count: sql<number>`count(*)` })
    .from(promptTemplates)
    .where(eq(promptTemplates.isSeed, true))
    .get();
  if (existing && existing.count >= SEED_TEMPLATES.length) return;

  const now = new Date();
  for (const t of SEED_TEMPLATES) {
    db.insert(promptTemplates)
      .values({
        id: t.id,
        category: t.category,
        title: t.title,
        body: t.body,
        variables: extractTemplateVariables(t.body),
        isSeed: true,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing()
      .run();
  }
}

export function listTemplates({
  category,
}: TemplateListOptions = {}): PromptTemplateRow[] {
  seedTemplatesOnce();
  return db
    .select()
    .from(promptTemplates)
    .where(category ? eq(promptTemplates.category, category) : undefined)
    .orderBy(
      asc(promptTemplates.category),
      desc(promptTemplates.usageCount),
      asc(promptTemplates.title),
    )
    .all();
}

/** Distinct category names for the sidebar. */
export function listTemplateCategories(): string[] {
  seedTemplatesOnce();
  const rows = db
    .selectDistinct({ category: promptTemplates.category })
    .from(promptTemplates)
    .orderBy(asc(promptTemplates.category))
    .all();
  return rows.map((r) => r.category);
}

export function getTemplate(id: string): PromptTemplateRow | undefined {
  return db
    .select()
    .from(promptTemplates)
    .where(eq(promptTemplates.id, id))
    .get();
}

export interface CreateTemplateInput {
  id: string;
  category?: string;
  title: string;
  body: string;
  variables?: string[] | null;
  isSeed?: boolean;
}

export function createTemplate(
  input: CreateTemplateInput,
): PromptTemplateRow {
  const now = new Date();
  db.insert(promptTemplates)
    .values({
      id: input.id,
      category: input.category ?? "general",
      title: input.title,
      body: input.body,
      variables: input.variables ?? null,
      isSeed: input.isSeed ?? false,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing()
    .run();
  return getTemplate(input.id) as PromptTemplateRow;
}

export function updateTemplate(
  id: string,
  patch: Partial<
    Pick<PromptTemplateRow, "category" | "title" | "body" | "variables">
  >,
): void {
  db.update(promptTemplates)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(promptTemplates.id, id))
    .run();
}

export function incrementTemplateUsage(id: string): void {
  db.update(promptTemplates)
    .set({ usageCount: sql`${promptTemplates.usageCount} + 1` })
    .where(eq(promptTemplates.id, id))
    .run();
}

export function deleteTemplate(id: string): void {
  db.delete(promptTemplates).where(eq(promptTemplates.id, id)).run();
}
