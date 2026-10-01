"use server";

import { unlink } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import {
  deleteGeneratedImage,
  getGeneratedImage,
  setImageFavorite,
} from "@/lib/db/queries";

const DATA_ROOT = path.join(process.cwd(), ".data");

/** Best-effort unlink for a DB-stored relative path, constrained to `.data/`. */
async function unlinkDataFile(relativePath: string): Promise<void> {
  const abs = path.resolve(DATA_ROOT, relativePath);
  // Never delete outside .data/ even if a row carries a poisoned path.
  if (abs !== DATA_ROOT && !abs.startsWith(DATA_ROOT + path.sep)) return;
  try {
    await unlink(abs);
  } catch {
    // File already gone / never written — the row removal is what matters.
  }
}

export async function toggleImageFavoriteAction(id: string) {
  const image = getGeneratedImage(id);
  if (image) setImageFavorite(id, !image.isFavorite);
  revalidatePath("/studio");
}

export async function deleteGeneratedImageAction(id: string) {
  const image = getGeneratedImage(id);
  if (!image) return;
  // Unlink the rendered file and any persisted i2i reference images, then
  // drop the row. Files live under `.data/images/`.
  await unlinkDataFile(image.filePath);
  for (const ref of image.inputImagePaths ?? []) {
    await unlinkDataFile(ref);
  }
  deleteGeneratedImage(id);
  revalidatePath("/studio");
}

export async function bulkDeleteGeneratedImagesAction(ids: string[]) {
  for (const id of ids) {
    const image = getGeneratedImage(id);
    if (!image) continue;
    await unlinkDataFile(image.filePath);
    for (const ref of image.inputImagePaths ?? []) {
      await unlinkDataFile(ref);
    }
    deleteGeneratedImage(id);
  }
  revalidatePath("/studio");
}
