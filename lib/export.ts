import type { ConversationRow } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/tools";

function partsToMarkdown(message: ChatMessage): string {
  const blocks: string[] = [];

  for (const part of message.parts) {
    switch (part.type) {
      case "text":
        blocks.push(part.text);
        break;
      case "reasoning":
        if (part.text.trim()) {
          blocks.push(
            `<details>\n<summary>Reasoning</summary>\n\n${part.text}\n\n</details>`,
          );
        }
        break;
      case "source-url": {
        const title = part.title ?? part.url;
        blocks.push(`> Source: [${title}](${part.url})`);
        break;
      }
      case "file":
        blocks.push(`> Attachment: ${part.filename ?? part.mediaType}`);
        break;
      default:
        if (part.type.startsWith("tool-")) {
          blocks.push(
            `\`\`\`json\n${JSON.stringify(part, null, 2)}\n\`\`\``,
          );
        }
    }
  }

  return blocks.join("\n\n");
}

export function conversationToMarkdown(
  conversation: ConversationRow,
  thread: ChatMessage[],
): string {
  const header = [
    `# ${conversation.title}`,
    "",
    `- Model: \`${conversation.modelId}\``,
    `- Messages: ${conversation.messageCount}`,
    `- Exported: ${new Date().toISOString()}`,
    "",
    "---",
  ].join("\n");

  const body = thread
    .map((message) => {
      const speaker = message.role === "user" ? "## You" : "## Studio";
      return `${speaker}\n\n${partsToMarkdown(message)}`;
    })
    .join("\n\n");

  return `${header}\n\n${body}\n`;
}

export function conversationToJson(
  conversation: ConversationRow,
  thread: ChatMessage[],
): string {
  return JSON.stringify(
    {
      id: conversation.id,
      title: conversation.title,
      modelId: conversation.modelId,
      createdAt: conversation.createdAt,
      exportedAt: new Date().toISOString(),
      messages: thread,
    },
    null,
    2,
  );
}

export function exportFilename(
  conversation: ConversationRow,
  extension: "md" | "json",
): string {
  const slug =
    conversation.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "conversation";
  return `${slug}-${conversation.id.slice(0, 8)}.${extension}`;
}
