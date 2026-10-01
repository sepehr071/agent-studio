import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { type GeneratedImageRow, generatedImages } from "@/lib/db/schema";

export interface ImageListOptions {
  favoritesOnly?: boolean;
  limit?: number;
}

export function listGeneratedImages({
  favoritesOnly = false,
  limit = 200,
}: ImageListOptions = {}): GeneratedImageRow[] {
  const rows = db
    .select()
    .from(generatedImages)
    .orderBy(desc(generatedImages.createdAt))
    .limit(limit)
    .all();
  return favoritesOnly ? rows.filter((r) => r.isFavorite) : rows;
}

export function getGeneratedImage(
  id: string,
): GeneratedImageRow | undefined {
  return db
    .select()
    .from(generatedImages)
    .where(eq(generatedImages.id, id))
    .get();
}

export interface CreateGeneratedImageInput {
  id: string;
  prompt: string;
  negativePrompt?: string | null;
  modelId: string;
  mode?: "t2i" | "i2i";
  aspectHint?: string | null;
  styleHint?: string | null;
  filePath: string;
  mimeType?: string;
  width?: number | null;
  height?: number | null;
  inputImagePaths?: string[] | null;
}

export function createGeneratedImage(
  input: CreateGeneratedImageInput,
): GeneratedImageRow {
  db.insert(generatedImages)
    .values({
      id: input.id,
      prompt: input.prompt,
      negativePrompt: input.negativePrompt ?? null,
      modelId: input.modelId,
      mode: input.mode ?? "t2i",
      aspectHint: input.aspectHint ?? null,
      styleHint: input.styleHint ?? null,
      filePath: input.filePath,
      mimeType: input.mimeType ?? "image/png",
      width: input.width ?? null,
      height: input.height ?? null,
      inputImagePaths: input.inputImagePaths ?? null,
      createdAt: new Date(),
    })
    .run();
  return getGeneratedImage(input.id) as GeneratedImageRow;
}

export function setImageFavorite(id: string, isFavorite: boolean): void {
  db.update(generatedImages)
    .set({ isFavorite })
    .where(eq(generatedImages.id, id))
    .run();
}

export function deleteGeneratedImage(id: string): void {
  db.delete(generatedImages).where(eq(generatedImages.id, id)).run();
}
