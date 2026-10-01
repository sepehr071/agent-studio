"use server";

import { revalidatePath } from "next/cache";
import {
  type CreateConfigInput,
  createConfig,
  deleteConfig,
  getConfig,
  updateConfig,
} from "@/lib/db/queries";
import type { ConfigRow } from "@/lib/db/schema";

export async function createConfigAction(
  input: Omit<CreateConfigInput, "id">,
): Promise<ConfigRow> {
  const config = createConfig({ id: crypto.randomUUID(), ...input });
  revalidatePath("/assistants");
  revalidatePath("/", "layout");
  return config;
}

export async function updateConfigAction(
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
) {
  updateConfig(id, patch);
  revalidatePath("/assistants");
  revalidatePath("/", "layout");
}

export async function deleteConfigAction(id: string) {
  deleteConfig(id);
  revalidatePath("/assistants");
  revalidatePath("/", "layout");
}

/** Pin/unpin an assistant (pinned float to the top of the grid + picker). */
export async function toggleConfigPinAction(id: string) {
  const config = getConfig(id);
  if (config) updateConfig(id, { isPinned: !config.isPinned });
  revalidatePath("/assistants");
  revalidatePath("/", "layout");
}

/** Clone an assistant into a fresh, unpinned copy (resets usage count). */
export async function duplicateConfigAction(id: string): Promise<ConfigRow | null> {
  const source = getConfig(id);
  if (!source) return null;
  const copy = createConfig({
    id: crypto.randomUUID(),
    name: `${source.name} (رونوشت)`.slice(0, 80),
    avatarEmoji: source.avatarEmoji,
    systemPrompt: source.systemPrompt,
    modelId: source.modelId,
    params: source.params,
    toolConfig: source.toolConfig,
  });
  revalidatePath("/assistants");
  revalidatePath("/", "layout");
  return copy;
}
