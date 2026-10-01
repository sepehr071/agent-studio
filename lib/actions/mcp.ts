"use server";

import { revalidatePath } from "next/cache";
import {
  type CreateMcpServerInput,
  createMcpServer,
  deleteMcpServer,
  getMcpServer,
  updateMcpServer,
} from "@/lib/db/queries";
import type { McpServerRow } from "@/lib/db/schema";
import { type McpTransportInput, openMcpClient } from "@/lib/mcp/client";

function revalidate(): void {
  revalidatePath("/settings");
  revalidatePath("/", "layout");
}

export async function createMcpServerAction(
  input: Omit<CreateMcpServerInput, "id">,
): Promise<McpServerRow> {
  const server = createMcpServer({ id: crypto.randomUUID(), ...input });
  revalidate();
  return server;
}

export async function updateMcpServerAction(
  id: string,
  patch: Partial<
    Pick<
      McpServerRow,
      | "name"
      | "transport"
      | "url"
      | "headers"
      | "command"
      | "args"
      | "env"
      | "isEnabled"
    >
  >,
): Promise<void> {
  updateMcpServer(id, patch);
  revalidate();
}

export async function deleteMcpServerAction(id: string): Promise<void> {
  deleteMcpServer(id);
  revalidate();
}

/**
 * Enable/disable a server without opening the edit dialog. Pass `enabled` to set
 * an explicit state (the Switch's target value — avoids a stale-read race);
 * omit it to flip the current value.
 */
export async function toggleMcpServerEnabledAction(
  id: string,
  enabled?: boolean,
): Promise<void> {
  if (enabled === undefined) {
    const server = getMcpServer(id);
    if (server) updateMcpServer(id, { isEnabled: !server.isEnabled });
  } else {
    updateMcpServer(id, { isEnabled: enabled });
  }
  revalidate();
}

/**
 * Open a transient client from the (possibly unsaved) transport fields, list
 * its tools, and close it. Lets the user verify a server BEFORE saving. Returns
 * tool names on success or a readable Persian error on failure.
 */
export async function testMcpServerAction(
  input: McpTransportInput,
): Promise<{ ok: true; toolNames: string[] } | { ok: false; error: string }> {
  let client: Awaited<ReturnType<typeof openMcpClient>> | null = null;
  try {
    client = await openMcpClient(input);
    const tools = await client.tools();
    return { ok: true, toolNames: Object.keys(tools) };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "خطای ناشناخته";
    return { ok: false, error: `اتصال به سرور MCP ناموفق بود: ${detail}` };
  } finally {
    if (client) await client.close().catch(() => {});
  }
}
