import { and, desc, eq, isNull, like } from "drizzle-orm";
import { db } from "@/lib/db";
import { type ConversationRow, conversations } from "@/lib/db/schema";

export function getConversation(id: string): ConversationRow | undefined {
  return db.select().from(conversations).where(eq(conversations.id, id)).get();
}

export interface ConversationListOptions {
  query?: string;
  includeArchived?: boolean;
  projectId?: string | null;
  folderId?: string | null;
  configId?: string;
  limit?: number;
}

export function listConversations({
  query,
  includeArchived = false,
  projectId,
  folderId,
  configId,
  limit = 200,
}: ConversationListOptions = {}): ConversationRow[] {
  const filters = [];
  if (!includeArchived) filters.push(eq(conversations.isArchived, false));
  if (query) filters.push(like(conversations.title, `%${query}%`));
  if (projectId !== undefined) {
    filters.push(
      projectId === null
        ? isNull(conversations.projectId)
        : eq(conversations.projectId, projectId),
    );
  }
  if (folderId !== undefined && folderId !== null) {
    filters.push(eq(conversations.folderId, folderId));
  }
  if (configId) filters.push(eq(conversations.configId, configId));

  return db
    .select()
    .from(conversations)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(conversations.lastMessageAt), desc(conversations.createdAt))
    .limit(limit)
    .all();
}

/** Conversations belonging to a project (any folder under it). */
export function listConversationsByProject(
  projectId: string,
): ConversationRow[] {
  return db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.projectId, projectId),
        eq(conversations.isArchived, false),
      ),
    )
    .orderBy(desc(conversations.lastMessageAt), desc(conversations.createdAt))
    .all();
}

export function createConversation(id: string, modelId: string): void {
  const now = new Date();
  db.insert(conversations)
    .values({ id, modelId, createdAt: now, updatedAt: now })
    .onConflictDoNothing()
    .run();
}

export function updateConversation(
  id: string,
  patch: Partial<
    Pick<
      ConversationRow,
      | "title"
      | "modelId"
      | "isPinned"
      | "isArchived"
      | "projectId"
      | "folderId"
      | "configId"
      | "tags"
      | "originMeetingId"
    >
  >,
): void {
  db.update(conversations)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(conversations.id, id))
    .run();
}

/** Move a conversation into a project (and clear/keep folder). */
export function setConversationProject(
  id: string,
  projectId: string | null,
  folderId: string | null = null,
): void {
  db.update(conversations)
    .set({ projectId, folderId, updatedAt: new Date() })
    .where(eq(conversations.id, id))
    .run();
}

export function setConversationFolder(
  id: string,
  folderId: string | null,
): void {
  db.update(conversations)
    .set({ folderId, updatedAt: new Date() })
    .where(eq(conversations.id, id))
    .run();
}

export function setConversationTags(id: string, tags: string[]): void {
  db.update(conversations)
    .set({ tags, updatedAt: new Date() })
    .where(eq(conversations.id, id))
    .run();
}

export function setConversationConfig(
  id: string,
  configId: string | null,
): void {
  db.update(conversations)
    .set({ configId, updatedAt: new Date() })
    .where(eq(conversations.id, id))
    .run();
}

export function deleteConversation(id: string): void {
  db.delete(conversations).where(eq(conversations.id, id)).run();
}
