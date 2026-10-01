"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  deleteConversation,
  getConversation,
  searchMessages,
  setConversationConfig,
  setConversationFolder,
  setConversationProject,
  setConversationTags,
  updateConversation,
} from "@/lib/db/queries";
import type { ChatMessage } from "@/lib/tools";

export interface MessageSearchResult {
  conversationId: string;
  messageId: string;
  conversationTitle: string;
  snippet: string;
}

/** Flatten the text parts of a stored message into a single string. */
function messagePartsToText(parts: ChatMessage["parts"]): string {
  return parts
    .filter((part): part is Extract<ChatMessage["parts"][number], { type: "text" }> =>
      part.type === "text",
    )
    .map((part) => part.text)
    .join(" ")
    .trim();
}

/**
 * FTS5 full-text search over message bodies for the sidebar (title-LIKE search
 * misses body hits). Returns conversation/message ids, the hydrated title, and
 * a text snippet flattened from the message's text parts (never a raw JSON
 * dump). Mirrors `searchKnowledgeAction`.
 */
export async function searchMessagesAction(
  query: string,
): Promise<MessageSearchResult[]> {
  const hits = searchMessages(query, 40);
  const titleCache = new Map<string, string>();
  const results: MessageSearchResult[] = [];

  for (const hit of hits) {
    if (!hit.message) continue;
    const snippet = messagePartsToText(hit.message.parts);
    if (!snippet) continue;

    let title = titleCache.get(hit.conversationId);
    if (title === undefined) {
      title = getConversation(hit.conversationId)?.title ?? "گفتگو";
      titleCache.set(hit.conversationId, title);
    }

    results.push({
      conversationId: hit.conversationId,
      messageId: hit.messageId,
      conversationTitle: title,
      snippet: snippet.length > 200 ? `${snippet.slice(0, 200)}…` : snippet,
    });
  }

  return results;
}

export async function renameConversationAction(id: string, title: string) {
  const trimmed = title.trim().slice(0, 120);
  if (trimmed) {
    updateConversation(id, { title: trimmed });
  }
  revalidatePath("/", "layout");
}

export async function togglePinAction(id: string) {
  const conversation = getConversation(id);
  if (conversation) {
    updateConversation(id, { isPinned: !conversation.isPinned });
  }
  revalidatePath("/", "layout");
}

export async function toggleArchiveAction(id: string) {
  const conversation = getConversation(id);
  if (conversation) {
    updateConversation(id, { isArchived: !conversation.isArchived });
  }
  revalidatePath("/", "layout");
}

export async function setModelAction(id: string, modelId: string) {
  // No revalidate — model isn't shown in the sidebar; avoids refresh churn
  if (getConversation(id)) {
    updateConversation(id, { modelId });
  }
}

export async function deleteConversationAction(
  id: string,
  currentConversationId?: string,
) {
  deleteConversation(id);
  revalidatePath("/", "layout");
  if (currentConversationId === id) {
    redirect("/");
  }
}

// ---------------------------------------------------------------- grouping

export async function moveConversationToProjectAction(
  id: string,
  projectId: string | null,
  folderId: string | null = null,
) {
  if (!getConversation(id)) return;
  setConversationProject(id, projectId, folderId);
  revalidatePath("/", "layout");
  revalidatePath("/projects");
  if (projectId) revalidatePath(`/projects/${projectId}`);
}

export async function moveConversationToFolderAction(
  id: string,
  folderId: string | null,
) {
  if (!getConversation(id)) return;
  setConversationFolder(id, folderId);
  revalidatePath("/", "layout");
  revalidatePath("/projects");
}

export async function setConversationTagsAction(id: string, tags: string[]) {
  if (!getConversation(id)) return;
  const cleaned = Array.from(
    new Set(tags.map((t) => t.trim()).filter(Boolean)),
  ).slice(0, 24);
  setConversationTags(id, cleaned);
  revalidatePath("/", "layout");
}

export async function bindConfigAction(
  id: string,
  configId: string | null,
) {
  if (!getConversation(id)) return;
  setConversationConfig(id, configId);
  revalidatePath("/", "layout");
}
