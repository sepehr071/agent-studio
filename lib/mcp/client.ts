import "server-only";
import { experimental_createMCPClient, type MCPClient } from "@ai-sdk/mcp";
import { Experimental_StdioMCPTransport } from "@ai-sdk/mcp/mcp-stdio";
import type { Tool, ToolSet } from "ai";
import type { McpServerRow } from "@/lib/db/schema";
import { listEnabledMcpServers } from "@/lib/db/queries/mcp";
import { sanitizeMcpToolOutput } from "@/lib/mcp/sanitize";

/** Transport fields the test-connection flow accepts BEFORE a row is saved. */
export interface McpTransportInput {
  transport: "http" | "sse" | "stdio";
  url?: string | null;
  headers?: Record<string, string> | null;
  command?: string | null;
  args?: string[] | null;
  env?: Record<string, string> | null;
}

/**
 * Open a single MCP client from transport fields. http/sse pass an inline
 * transport-config object; stdio spawns a child process via the stdio
 * transport. Throws a readable Persian error when required fields are missing.
 */
export async function openMcpClient(
  input: McpTransportInput,
): Promise<MCPClient> {
  if (input.transport === "stdio") {
    const command = input.command?.trim();
    if (!command) {
      throw new Error("دستور اجرای سرور MCP خالی است.");
    }
    // Windows: bare commands like `npx`/`uvx` are cmd-shims (.cmd), not
    // executables — spawn() throws ENOENT on them. Route bare commands through
    // cmd.exe so PATH + PATHEXT resolution applies; explicit paths spawn as-is.
    const isBareWinCommand =
      process.platform === "win32" &&
      !command.includes("/") &&
      !command.includes("\\");
    return experimental_createMCPClient({
      transport: new Experimental_StdioMCPTransport({
        command: isBareWinCommand ? "cmd" : command,
        args: isBareWinCommand
          ? ["/c", command, ...(input.args ?? [])]
          : (input.args ?? undefined),
        // Minimal allowlisted env so PATH/system vars resolve, then layer the
        // server's own vars (API keys) on top.
        env: { ...sanitizedProcessEnv(), ...(input.env ?? {}) },
      }),
    });
  }

  const url = input.url?.trim();
  if (!url) {
    throw new Error("آدرس سرور MCP خالی است.");
  }
  return experimental_createMCPClient({
    transport: {
      type: input.transport,
      url,
      headers: input.headers ?? undefined,
    },
  });
}

/** Only what a child process needs to resolve binaries; never app secrets. */
const ENV_ALLOWLIST = [
  "PATH",
  "PATHEXT",
  "HOME",
  "USERPROFILE",
  "SYSTEMROOT",
  "COMSPEC",
  "TEMP",
  "TMP",
  "TMPDIR",
  "APPDATA",
  "LOCALAPPDATA",
];

/** Allowlisted subset of process.env (keeps API keys out of MCP children). */
function sanitizedProcessEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of ENV_ALLOWLIST) {
    const value = process.env[key];
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

/**
 * Wrap a tool so its execute result passes through the sanitizer (base64
 * decode, HTML→text, per-field + whole-result caps) — see lib/mcp/sanitize.ts
 * for why raw MCP outputs must never reach the model unfiltered.
 */
function withOutputSanitizer(tool: Tool): Tool {
  const execute = tool.execute;
  if (!execute) return tool;
  return {
    ...tool,
    execute: async (input, options) =>
      sanitizeMcpToolOutput(await execute(input, options)),
  } as Tool;
}

export interface CollectedMcpTools {
  tools: ToolSet;
  clients: MCPClient[];
  errors: string[];
}

/**
 * Open the given enabled MCP servers, merge their tool sets, and hand back the
 * open clients so the caller can `close()` them after streaming. One dead
 * server never blocks the others (`Promise.allSettled`); each failure becomes a
 * readable Persian error string. The caller MUST close every returned client.
 */
export async function collectMcpTools(
  serverIds: string[],
): Promise<CollectedMcpTools> {
  if (serverIds.length === 0) {
    return { tools: {}, clients: [], errors: [] };
  }

  // Resolve rows by id, keeping only enabled ones (the source of truth is the
  // DB row's isEnabled flag, not the assistant's stale selection).
  const enabled = listEnabledMcpServers();
  const byId = new Map(enabled.map((row) => [row.id, row]));
  const rows = serverIds
    .map((id) => byId.get(id))
    .filter((row): row is McpServerRow => row !== undefined);

  const results = await Promise.allSettled(
    rows.map(async (row) => {
      const client = await openMcpClient(row);
      try {
        const tools = await client.tools();
        return { client, tools, name: row.name };
      } catch (error) {
        // Close immediately on a post-connect failure so we never leak a
        // half-open stdio process.
        await client.close().catch(() => {});
        throw error;
      }
    }),
  );

  const tools: ToolSet = {};
  const clients: MCPClient[] = [];
  const errors: string[] = [];

  results.forEach((result, i) => {
    const name = rows[i]?.name ?? "?";
    if (result.status === "fulfilled") {
      clients.push(result.value.client);
      for (const [toolName, tool] of Object.entries(result.value.tools)) {
        tools[toolName] = withOutputSanitizer(tool);
      }
    } else {
      errors.push(`سرور MCP «${name}» در دسترس نیست.`);
    }
  });

  return { tools, clients, errors };
}

/** Close every client, swallowing individual close failures. */
export async function closeMcpClients(clients: MCPClient[]): Promise<void> {
  await Promise.allSettled(clients.map((client) => client.close()));
}
