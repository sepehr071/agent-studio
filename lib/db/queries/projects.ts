import { asc, count, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { type ProjectRow, conversations, projects } from "@/lib/db/schema";

export interface ProjectListOptions {
  includeArchived?: boolean;
}

export function listProjects({
  includeArchived = false,
}: ProjectListOptions = {}): ProjectRow[] {
  const rows = db
    .select()
    .from(projects)
    .orderBy(
      desc(projects.isPinned),
      asc(projects.sortOrder),
      desc(projects.updatedAt),
    )
    .all();
  return includeArchived ? rows : rows.filter((p) => !p.isArchived);
}

export function getProject(id: string): ProjectRow | undefined {
  return db.select().from(projects).where(eq(projects.id, id)).get();
}

export interface CreateProjectInput {
  id: string;
  name: string;
  description?: string | null;
  color?: string | null;
  emoji?: string | null;
}

export function createProject(input: CreateProjectInput): ProjectRow {
  const now = new Date();
  db.insert(projects)
    .values({
      id: input.id,
      name: input.name,
      description: input.description ?? null,
      color: input.color ?? null,
      emoji: input.emoji ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return getProject(input.id) as ProjectRow;
}

export function updateProject(
  id: string,
  patch: Partial<
    Pick<
      ProjectRow,
      | "name"
      | "description"
      | "color"
      | "emoji"
      | "isPinned"
      | "isArchived"
      | "sortOrder"
    >
  >,
): void {
  db.update(projects)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(projects.id, id))
    .run();
}

export function deleteProject(id: string): void {
  db.delete(projects).where(eq(projects.id, id)).run();
}

/**
 * Non-archived conversation count per project, as a `{ [projectId]: n }` map.
 * One grouped query rather than N round-trips for the board cards.
 */
export function countConversationsByProject(): Record<string, number> {
  const rows = db
    .select({ projectId: conversations.projectId, n: count() })
    .from(conversations)
    .where(eq(conversations.isArchived, false))
    .groupBy(conversations.projectId)
    .all();
  const map: Record<string, number> = {};
  for (const row of rows) {
    if (row.projectId) map[row.projectId] = row.n;
  }
  return map;
}
