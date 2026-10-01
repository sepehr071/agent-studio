import type { Metadata } from "next";
import {
  type ProjectCardData,
  ProjectsBoard,
} from "@/components/app/projects-board";
import { countConversationsByProject, listProjects } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "پروژه‌ها" };

export default function ProjectsPage() {
  const projects = listProjects();
  const counts = countConversationsByProject();
  const cards: ProjectCardData[] = projects.map((p) => ({
    ...p,
    conversationCount: counts[p.id] ?? 0,
  }));

  return (
    <div className="h-dvh overflow-y-auto">
      <div className="mx-auto w-full max-w-5xl px-6 py-8">
        <ProjectsBoard projects={cards} />
      </div>
    </div>
  );
}
