import { ChatPane } from "@/components/app/chat-pane";
import { getSettings, listConfigs } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export default function NewChatPage() {
  // Mint the conversation id server-side; the row is created on first message
  const conversationId = crypto.randomUUID();
  const settings = getSettings();
  const configs = listConfigs();

  return (
    <ChatPane
      configs={configs}
      conversationId={conversationId}
      initialMessages={[]}
      initialModelId={settings.defaultModelId}
      isNew
      key={conversationId}
    />
  );
}
