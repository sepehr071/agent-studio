import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  type KnowledgeFolderRow,
  type KnowledgeItemRow,
  knowledgeFolders,
  knowledgeItems,
} from "@/lib/db/schema";

// ---------------------------------------------------------------- folders

export function listKnowledgeFolders(): KnowledgeFolderRow[] {
  return db
    .select()
    .from(knowledgeFolders)
    .orderBy(asc(knowledgeFolders.sortOrder), asc(knowledgeFolders.name))
    .all();
}

export function listRootKnowledgeFolders(): KnowledgeFolderRow[] {
  return db
    .select()
    .from(knowledgeFolders)
    .where(isNull(knowledgeFolders.parentId))
    .orderBy(asc(knowledgeFolders.sortOrder), asc(knowledgeFolders.name))
    .all();
}

export function getKnowledgeFolder(
  id: string,
): KnowledgeFolderRow | undefined {
  return db
    .select()
    .from(knowledgeFolders)
    .where(eq(knowledgeFolders.id, id))
    .get();
}

export interface CreateKnowledgeFolderInput {
  id: string;
  parentId?: string | null;
  name: string;
}

export function createKnowledgeFolder(
  input: CreateKnowledgeFolderInput,
): KnowledgeFolderRow {
  const now = new Date();
  db.insert(knowledgeFolders)
    .values({
      id: input.id,
      parentId: input.parentId ?? null,
      name: input.name,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return getKnowledgeFolder(input.id) as KnowledgeFolderRow;
}

export function updateKnowledgeFolder(
  id: string,
  patch: Partial<Pick<KnowledgeFolderRow, "name" | "parentId" | "sortOrder">>,
): void {
  db.update(knowledgeFolders)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(knowledgeFolders.id, id))
    .run();
}

export function deleteKnowledgeFolder(id: string): void {
  db.delete(knowledgeFolders).where(eq(knowledgeFolders.id, id)).run();
}

// ---------------------------------------------------------------- items

export interface KnowledgeListOptions {
  folderId?: string | null;
  favoritesOnly?: boolean;
  limit?: number;
}

export function listKnowledgeItems({
  folderId,
  favoritesOnly = false,
  limit = 500,
}: KnowledgeListOptions = {}): KnowledgeItemRow[] {
  const filters = [];
  if (folderId !== undefined) {
    filters.push(
      folderId === null
        ? isNull(knowledgeItems.folderId)
        : eq(knowledgeItems.folderId, folderId),
    );
  }
  if (favoritesOnly) filters.push(eq(knowledgeItems.isFavorite, true));

  return db
    .select()
    .from(knowledgeItems)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(knowledgeItems.updatedAt))
    .limit(limit)
    .all();
}

export function getKnowledgeItem(id: string): KnowledgeItemRow | undefined {
  return db
    .select()
    .from(knowledgeItems)
    .where(eq(knowledgeItems.id, id))
    .get();
}

export interface CreateKnowledgeItemInput {
  id: string;
  folderId?: string | null;
  title: string;
  content?: string;
  sourceConversationId?: string | null;
  sourceMessageId?: string | null;
  modelId?: string | null;
  tags?: string[] | null;
}

export function createKnowledgeItem(
  input: CreateKnowledgeItemInput,
): KnowledgeItemRow {
  const now = new Date();
  db.insert(knowledgeItems)
    .values({
      id: input.id,
      folderId: input.folderId ?? null,
      title: input.title,
      content: input.content ?? "",
      sourceConversationId: input.sourceConversationId ?? null,
      sourceMessageId: input.sourceMessageId ?? null,
      modelId: input.modelId ?? null,
      tags: input.tags ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return getKnowledgeItem(input.id) as KnowledgeItemRow;
}

export function updateKnowledgeItem(
  id: string,
  patch: Partial<
    Pick<
      KnowledgeItemRow,
      "title" | "content" | "folderId" | "tags" | "isFavorite"
    >
  >,
): void {
  db.update(knowledgeItems)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(knowledgeItems.id, id))
    .run();
}

export function deleteKnowledgeItem(id: string): void {
  db.delete(knowledgeItems).where(eq(knowledgeItems.id, id)).run();
}
