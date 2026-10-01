import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChatPane } from "@/components/app/chat-pane";
import {
  getConversation,
  listConfigs,
  loadChatMessages,
} from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const conversation = getConversation(id);
  return {
    title: conversation ? `${conversation.title} · Agent Studio` : "Agent Studio",
  };
}

export default async function ChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const conversation = getConversation(id);
  if (!conversation) {
    notFound();
  }

  const initialMessages = loadChatMessages(id);
  const configs = listConfigs();

  return (
    <ChatPane
      configs={configs}
      conversationId={id}
      initialConfigId={conversation.configId}
      initialMessages={initialMessages}
      initialModelId={conversation.modelId}
      initialTitle={conversation.title}
      key={id}
    />
  );
}
