"use server";

import { revalidatePath } from "next/cache";
import {
  type CreateKnowledgeFolderInput,
  type CreateKnowledgeItemInput,
  createKnowledgeFolder,
  createKnowledgeItem,
  deleteKnowledgeFolder,
  deleteKnowledgeItem,
  getKnowledgeItem,
  searchKnowledge,
  updateKnowledgeFolder,
  updateKnowledgeItem,
} from "@/lib/db/queries";
import type { KnowledgeFolderRow, KnowledgeItemRow } from "@/lib/db/schema";

/** FTS5 full-text search over knowledge items (title + content). */
export async function searchKnowledgeAction(
  query: string,
): Promise<KnowledgeItemRow[]> {
  return searchKnowledge(query, 60);
}

// ---------------------------------------------------------------- folders

export async function createKnowledgeFolderAction(
  input: Omit<CreateKnowledgeFolderInput, "id">,
): Promise<KnowledgeFolderRow> {
  const folder = createKnowledgeFolder({ id: crypto.randomUUID(), ...input });
  revalidatePath("/knowledge");
  return folder;
}

export async function updateKnowledgeFolderAction(
  id: string,
  patch: Partial<Pick<KnowledgeFolderRow, "name" | "parentId" | "sortOrder">>,
) {
  updateKnowledgeFolder(id, patch);
  revalidatePath("/knowledge");
}

export async function deleteKnowledgeFolderAction(id: string) {
  deleteKnowledgeFolder(id);
  revalidatePath("/knowledge");
}

// ---------------------------------------------------------------- items

export async function createKnowledgeItemAction(
  input: Omit<CreateKnowledgeItemInput, "id">,
): Promise<KnowledgeItemRow> {
  const item = createKnowledgeItem({ id: crypto.randomUUID(), ...input });
  revalidatePath("/knowledge");
  return item;
}

/** "ذخیره در گنجینه" — bookmark an assistant reply into the vault. */
export async function saveToKnowledgeAction(input: {
  title: string;
  content: string;
  sourceConversationId?: string | null;
  sourceMessageId?: string | null;
  modelId?: string | null;
  folderId?: string | null;
}): Promise<KnowledgeItemRow> {
  const item = createKnowledgeItem({ id: crypto.randomUUID(), ...input });
  revalidatePath("/knowledge");
  return item;
}

/**
 * Bookmark an assistant reply into the vault. Called by chat-pane's
 * "ذخیره در گنجینه" affordance. Title defaults to the first line of the
 * content (trimmed to 80 chars); the jump-back link is reconstructed from
 * `conversationId` + `messageId` on the knowledge card.
 */
export async function bookmarkReply(
  messageId: string,
  conversationId: string,
  content: string,
  title?: string,
  modelId?: string | null,
): Promise<KnowledgeItemRow> {
  const fallbackTitle =
    content.trim().split("\n")[0]?.slice(0, 80).trim() || "پاسخ ذخیره‌شده";
  const item = createKnowledgeItem({
    id: crypto.randomUUID(),
    title: (title?.trim() || fallbackTitle).slice(0, 120),
    content,
    sourceConversationId: conversationId,
    sourceMessageId: messageId,
    modelId: modelId ?? null,
  });
  revalidatePath("/knowledge");
  return item;
}

export async function updateKnowledgeItemAction(
  id: string,
  patch: Partial<
    Pick<
      KnowledgeItemRow,
      "title" | "content" | "folderId" | "tags" | "isFavorite"
    >
  >,
) {
  updateKnowledgeItem(id, patch);
  revalidatePath("/knowledge");
}

export async function toggleKnowledgeFavoriteAction(id: string) {
  const item = getKnowledgeItem(id);
  if (item) updateKnowledgeItem(id, { isFavorite: !item.isFavorite });
  revalidatePath("/knowledge");
}

export async function deleteKnowledgeItemAction(id: string) {
  deleteKnowledgeItem(id);
  revalidatePath("/knowledge");
}
