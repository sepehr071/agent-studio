import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  ProjectDetail,
  type ScopedConversation,
} from "@/components/app/project-detail";
import {
  getProject,
  listConversationsByProject,
  listFolders,
} from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const project = getProject(id);
  return { title: project ? `${project.name} · پروژه` : "پروژه" };
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = getProject(id);
  if (!project) notFound();

  const folders = listFolders(id);
  const conversations: ScopedConversation[] = listConversationsByProject(
    id,
  ).map((c) => ({
    id: c.id,
    title: c.title,
    folderId: c.folderId,
    tags: c.tags ?? [],
    isPinned: c.isPinned,
    isArchived: c.isArchived,
  }));

  return (
    <div className="h-dvh overflow-y-auto">
      <ProjectDetail
        conversations={conversations}
        folders={folders}
        project={project}
      />
    </div>
  );
}
