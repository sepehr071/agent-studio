import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { type ConfigRow, configs } from "@/lib/db/schema";
import type { ConfigParams, ConfigToolConfig } from "@/lib/db/types";

export function listConfigs(): ConfigRow[] {
  return db
    .select()
    .from(configs)
    .orderBy(
      desc(configs.isPinned),
      desc(configs.usageCount),
      desc(configs.updatedAt),
    )
    .all();
}

export function getConfig(id: string): ConfigRow | undefined {
  return db.select().from(configs).where(eq(configs.id, id)).get();
}

export interface CreateConfigInput {
  id: string;
  name: string;
  avatarEmoji?: string | null;
  systemPrompt?: string;
  modelId: string;
  params?: ConfigParams | null;
  toolConfig?: ConfigToolConfig | null;
}

export function createConfig(input: CreateConfigInput): ConfigRow {
  const now = new Date();
  db.insert(configs)
    .values({
      id: input.id,
      name: input.name,
      avatarEmoji: input.avatarEmoji ?? null,
      systemPrompt: input.systemPrompt ?? "",
      modelId: input.modelId,
      params: input.params ?? null,
      toolConfig: input.toolConfig ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return getConfig(input.id) as ConfigRow;
}

export function updateConfig(
  id: string,
  patch: Partial<
    Pick<
      ConfigRow,
      | "name"
      | "avatarEmoji"
      | "systemPrompt"
      | "modelId"
      | "params"
      | "toolConfig"
      | "isPinned"
    >
  >,
): void {
  db.update(configs)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(configs.id, id))
    .run();
}

/** Bump usage when a config is used to start/continue a chat. */
export function incrementConfigUsage(id: string): void {
  db.update(configs)
    .set({ usageCount: sql`${configs.usageCount} + 1` })
    .where(eq(configs.id, id))
    .run();
}

export function deleteConfig(id: string): void {
  db.delete(configs).where(eq(configs.id, id)).run();
}
