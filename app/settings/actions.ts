"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { updateSettings } from "@/lib/db/queries";

const settingsSchema = z.object({
  defaultModelId: z.string().min(1),
  aiPrefsEnabled: z.boolean(),
  userName: z.string().max(80).nullable(),
  outputLanguage: z.string().max(40).nullable(),
  expertiseLevel: z.enum(["beginner", "intermediate", "expert"]).nullable(),
  tone: z.enum(["professional", "friendly", "casual"]).nullable(),
  responseStyle: z.enum(["concise", "balanced", "detailed"]).nullable(),
  customInstructions: z.string().max(2000).nullable(),
});

export type SettingsInput = z.infer<typeof settingsSchema>;

export async function saveSettingsAction(
  input: SettingsInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
  }

  updateSettings(parsed.data);
  revalidatePath("/", "layout");
  return { ok: true };
}
