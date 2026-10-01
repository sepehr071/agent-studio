import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { type SettingsRow, settings } from "@/lib/db/schema";
import { DEFAULT_MODEL_ID } from "@/lib/models";

const SETTINGS_ID = "singleton";

export function getSettings(): SettingsRow {
  const row = db
    .select()
    .from(settings)
    .where(eq(settings.id, SETTINGS_ID))
    .get();
  if (row) return row;

  const defaults: SettingsRow = {
    id: SETTINGS_ID,
    defaultModelId: DEFAULT_MODEL_ID,
    aiPrefsEnabled: false,
    userName: null,
    outputLanguage: null,
    expertiseLevel: null,
    tone: null,
    responseStyle: null,
    customInstructions: null,
    updatedAt: null,
  };
  db.insert(settings).values(defaults).onConflictDoNothing().run();
  return defaults;
}

export function updateSettings(
  patch: Partial<Omit<SettingsRow, "id" | "updatedAt">>,
): SettingsRow {
  getSettings(); // ensure row exists
  db.update(settings)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(settings.id, SETTINGS_ID))
    .run();
  return getSettings();
}
