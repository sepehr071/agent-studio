import {
  conversationToJson,
  conversationToMarkdown,
  exportFilename,
} from "@/lib/export";
import { getConversation, loadChatMessages } from "@/lib/db/queries";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const conversation = getConversation(id);
  if (!conversation) {
    return Response.json({ error: "Conversation not found" }, { status: 404 });
  }

  const format =
    new URL(req.url).searchParams.get("format") === "json" ? "json" : "md";
  const thread = loadChatMessages(id);

  const body =
    format === "json"
      ? conversationToJson(conversation, thread)
      : conversationToMarkdown(conversation, thread);

  return new Response(body, {
    headers: {
      "Content-Type":
        format === "json"
          ? "application/json; charset=utf-8"
          : "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFilename(conversation, format)}"`,
    },
  });
}
