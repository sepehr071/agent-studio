import type { Metadata } from "next";
import { AssistantsGrid } from "@/components/app/assistants-grid";
import { listConfigs, listMcpServers } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "دستیارها — استودیو" };

export default function AssistantsPage() {
  const configs = listConfigs();
  const mcpServers = listMcpServers();

  return (
    <div className="h-dvh overflow-y-auto">
      <AssistantsGrid configs={configs} mcpServers={mcpServers} />
    </div>
  );
}
