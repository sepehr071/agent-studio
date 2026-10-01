import type { Metadata } from "next";
import { KnowledgeShell } from "@/components/app/knowledge-shell";
import { listKnowledgeFolders, listKnowledgeItems } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "گنجینه دانش" };

export default function KnowledgePage() {
  const folders = listKnowledgeFolders();
  const items = listKnowledgeItems();

  return (
    <div className="h-dvh overflow-y-auto">
      <KnowledgeShell folders={folders} items={items} />
    </div>
  );
}
