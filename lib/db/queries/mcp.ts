import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { type McpServerRow, mcpServers } from "@/lib/db/schema";

export function listMcpServers(): McpServerRow[] {
  return db
    .select()
    .from(mcpServers)
    .orderBy(desc(mcpServers.updatedAt))
    .all();
}

/** Only enabled servers — what the chat route considers connecting to. */
export function listEnabledMcpServers(): McpServerRow[] {
  return db
    .select()
    .from(mcpServers)
    .where(eq(mcpServers.isEnabled, true))
    .orderBy(desc(mcpServers.updatedAt))
    .all();
}

export function getMcpServer(id: string): McpServerRow | undefined {
  return db.select().from(mcpServers).where(eq(mcpServers.id, id)).get();
}

export interface CreateMcpServerInput {
  id: string;
  name: string;
  transport: "http" | "sse" | "stdio";
  url?: string | null;
  headers?: Record<string, string> | null;
  command?: string | null;
  args?: string[] | null;
  env?: Record<string, string> | null;
  isEnabled?: boolean;
}

export function createMcpServer(input: CreateMcpServerInput): McpServerRow {
  const now = new Date();
  db.insert(mcpServers)
    .values({
      id: input.id,
      name: input.name,
      transport: input.transport,
      url: input.url ?? null,
      headers: input.headers ?? null,
      command: input.command ?? null,
      args: input.args ?? null,
      env: input.env ?? null,
      isEnabled: input.isEnabled ?? true,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return getMcpServer(input.id) as McpServerRow;
}

export function updateMcpServer(
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
): void {
  db.update(mcpServers)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(mcpServers.id, id))
    .run();
}

export function deleteMcpServer(id: string): void {
  db.delete(mcpServers).where(eq(mcpServers.id, id)).run();
}
