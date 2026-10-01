import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { type MessageRow, conversations, messages } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/tools";

export function listMessages(conversationId: string): MessageRow[] {
  return db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(messages.orderIndex)
    .all();
}

/** Rehydrate DB rows into the UIMessage shape useChat expects. */
export function loadChatMessages(conversationId: string): ChatMessage[] {
  return listMessages(conversationId).map((row) => ({
    id: row.id,
    role: row.role as ChatMessage["role"],
    parts: row.parts,
    metadata: row.metadata ?? undefined,
  }));
}

/** Fetch one message row by id (e.g. for "save to knowledge"). */
export function getMessage(
  conversationId: string,
  messageId: string,
): MessageRow | undefined {
  return db
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.id, messageId),
        eq(messages.conversationId, conversationId),
      ),
    )
    .get();
}

/**
 * Persist the full reconciled thread from onFinish: upsert each message by id
 * with its position as orderIndex, then refresh conversation rollups.
 */
export function saveChatMessages(
  conversationId: string,
  thread: ChatMessage[],
): void {
  const now = new Date();

  db.transaction((tx) => {
    thread.forEach((message, orderIndex) => {
      tx.insert(messages)
        .values({
          id: message.id,
          conversationId,
          role: message.role,
          parts: message.parts,
          metadata: message.metadata ?? null,
          orderIndex,
          createdAt: now,
        })
        .onConflictDoUpdate({
          target: messages.id,
          set: {
            parts: message.parts,
            metadata: message.metadata ?? null,
            orderIndex,
          },
        })
        .run();
    });

    // Token rollups: sum assistant metadata across the thread (authoritative,
    // avoids drift from regenerate/edit truncation)
    let inputTokens = 0;
    let outputTokens = 0;
    let totalTokens = 0;
    for (const message of thread) {
      inputTokens += message.metadata?.inputTokens ?? 0;
      outputTokens += message.metadata?.outputTokens ?? 0;
      totalTokens += message.metadata?.totalTokens ?? 0;
    }

    tx.update(conversations)
      .set({
        messageCount: thread.length,
        inputTokens,
        outputTokens,
        totalTokens,
        lastMessageAt: now,
        updatedAt: now,
      })
      .where(eq(conversations.id, conversationId))
      .run();
  });
}

/** Destructive truncate: delete a message and everything after it. */
export function deleteMessagesFrom(
  conversationId: string,
  messageId: string,
): void {
  const target = db
    .select({ orderIndex: messages.orderIndex })
    .from(messages)
    .where(
      and(
        eq(messages.id, messageId),
        eq(messages.conversationId, conversationId),
      ),
    )
    .get();
  if (!target) return;

  db.transaction((tx) => {
    tx.delete(messages)
      .where(
        and(
          eq(messages.conversationId, conversationId),
          gte(messages.orderIndex, target.orderIndex),
        ),
      )
      .run();
    tx.update(conversations)
      .set({
        messageCount: sql`(select count(*) from messages where conversation_id = ${conversationId})`,
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, conversationId))
      .run();
  });
}
