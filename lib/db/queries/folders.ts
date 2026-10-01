import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { type FolderRow, folders } from "@/lib/db/schema";

export function listFolders(projectId: string): FolderRow[] {
  return db
    .select()
    .from(folders)
    .where(eq(folders.projectId, projectId))
    .orderBy(asc(folders.sortOrder), asc(folders.name))
    .all();
}

/** Top-level folders (no parent) within a project. */
export function listRootFolders(projectId: string): FolderRow[] {
  return db
    .select()
    .from(folders)
    .where(and(eq(folders.projectId, projectId), isNull(folders.parentId)))
    .orderBy(asc(folders.sortOrder), asc(folders.name))
    .all();
}

export function getFolder(id: string): FolderRow | undefined {
  return db.select().from(folders).where(eq(folders.id, id)).get();
}

export interface CreateFolderInput {
  id: string;
  projectId?: string | null;
  parentId?: string | null;
  name: string;
}

export function createFolder(input: CreateFolderInput): FolderRow {
  const now = new Date();
  db.insert(folders)
    .values({
      id: input.id,
      projectId: input.projectId ?? null,
      parentId: input.parentId ?? null,
      name: input.name,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return getFolder(input.id) as FolderRow;
}

export function updateFolder(
  id: string,
  patch: Partial<Pick<FolderRow, "name" | "parentId" | "sortOrder">>,
): void {
  db.update(folders)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(folders.id, id))
    .run();
}

export function deleteFolder(id: string): void {
  db.delete(folders).where(eq(folders.id, id)).run();
}
