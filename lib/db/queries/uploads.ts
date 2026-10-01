import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { type UploadRow, uploads } from "@/lib/db/schema";

export type ExtractStatus = UploadRow["extractStatus"];

export function getUpload(id: string): UploadRow | undefined {
  return db.select().from(uploads).where(eq(uploads.id, id)).get();
}

export function listUploads(conversationId?: string): UploadRow[] {
  return db
    .select()
    .from(uploads)
    .where(
      conversationId
        ? eq(uploads.conversationId, conversationId)
        : undefined,
    )
    .orderBy(desc(uploads.createdAt))
    .all();
}

export interface CreateUploadInput {
  id: string;
  filename: string;
  mimeType: string;
  ext?: string | null;
  sizeBytes?: number;
  filePath: string;
  extractedText?: string | null;
  extractStatus?: ExtractStatus;
  conversationId?: string | null;
}

export function createUpload(input: CreateUploadInput): UploadRow {
  db.insert(uploads)
    .values({
      id: input.id,
      filename: input.filename,
      mimeType: input.mimeType,
      ext: input.ext ?? null,
      sizeBytes: input.sizeBytes ?? 0,
      filePath: input.filePath,
      extractedText: input.extractedText ?? null,
      extractStatus: input.extractStatus ?? "unavailable",
      conversationId: input.conversationId ?? null,
      createdAt: new Date(),
    })
    .run();
  return getUpload(input.id) as UploadRow;
}

export function deleteUpload(id: string): void {
  db.delete(uploads).where(eq(uploads.id, id)).run();
}
