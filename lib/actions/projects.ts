"use server";

import { revalidatePath } from "next/cache";
import {
  type CreateFolderInput,
  type CreateProjectInput,
  createFolder,
  createProject,
  deleteFolder,
  deleteProject,
  updateFolder,
  updateProject,
} from "@/lib/db/queries";
import type { FolderRow, ProjectRow } from "@/lib/db/schema";

// ---------------------------------------------------------------- projects

export async function createProjectAction(
  input: Omit<CreateProjectInput, "id">,
): Promise<ProjectRow> {
  const project = createProject({ id: crypto.randomUUID(), ...input });
  revalidatePath("/projects");
  revalidatePath("/", "layout");
  return project;
}

export async function updateProjectAction(
  id: string,
  patch: Partial<
    Pick<
      ProjectRow,
      | "name"
      | "description"
      | "color"
      | "emoji"
      | "isPinned"
      | "isArchived"
      | "sortOrder"
    >
  >,
) {
  updateProject(id, patch);
  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
  revalidatePath("/", "layout");
}

export async function deleteProjectAction(id: string) {
  deleteProject(id);
  revalidatePath("/projects");
  revalidatePath("/", "layout");
}

// ---------------------------------------------------------------- folders

export async function createFolderAction(
  input: Omit<CreateFolderInput, "id">,
): Promise<FolderRow> {
  const folder = createFolder({ id: crypto.randomUUID(), ...input });
  if (input.projectId) revalidatePath(`/projects/${input.projectId}`);
  revalidatePath("/projects");
  return folder;
}

export async function updateFolderAction(
  id: string,
  patch: Partial<Pick<FolderRow, "name" | "parentId" | "sortOrder">>,
) {
  updateFolder(id, patch);
  revalidatePath("/projects");
}

export async function deleteFolderAction(id: string) {
  deleteFolder(id);
  revalidatePath("/projects");
}
