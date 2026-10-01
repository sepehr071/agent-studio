import fs from "node:fs";
import path from "node:path";

/** Catalog entry mapped from the OpenRouter /models API */
export interface CatalogModel {
  id: string;
  name: string;
  contextWindow: number;
  /** USD per 1M tokens */
  promptPrice: number;
  completionPrice: number;
  supportsVision: boolean;
  supportsTools: boolean;
  /** Emits image output (output_modalities includes "image") */
  supportsImageOutput: boolean;
}

interface OpenRouterModel {
  id: string;
  name: string;
  context_length: number | null;
  architecture?: {
    input_modalities?: string[];
    output_modalities?: string[];
  };
  pricing?: {
    prompt?: string;
    completion?: string;
  };
  supported_parameters?: string[];
}

const TTL_MS = 60 * 60 * 1000;
const DISK_PATH = path.join(process.cwd(), ".data", "openrouter-catalog.json");

// This network drops DNS/connections to openrouter.ai intermittently. The
// catalog barely changes, so: retry briefly, serve stale on failure, and
// persist the last good copy to disk so it survives server restarts.
let memCache: { data: CatalogModel[]; fetchedAt: number } | null = null;

async function fetchOnce(): Promise<CatalogModel[]> {
  const res = await fetch("https://openrouter.ai/api/v1/models", {
    headers: { "X-Title": "Agent Studio" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    throw new Error(`OpenRouter catalog fetch failed: ${res.status}`);
  }

  const { data } = (await res.json()) as { data: OpenRouterModel[] };

  return data
    .filter((m) => m.context_length)
    .map((m) => ({
      id: m.id,
      name: m.name,
      contextWindow: m.context_length ?? 0,
      promptPrice: Number(m.pricing?.prompt ?? 0) * 1_000_000,
      completionPrice: Number(m.pricing?.completion ?? 0) * 1_000_000,
      supportsVision:
        m.architecture?.input_modalities?.includes("image") ?? false,
      supportsTools: m.supported_parameters?.includes("tools") ?? false,
      supportsImageOutput:
        m.architecture?.output_modalities?.includes("image") ?? false,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

async function fetchWithRetry(): Promise<CatalogModel[]> {
  const delays = [0, 500, 1500];
  let lastError: unknown;
  for (const delay of delays) {
    if (delay) await new Promise((r) => setTimeout(r, delay));
    try {
      return await fetchOnce();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

function readDisk(): CatalogModel[] | null {
  try {
    const raw = fs.readFileSync(DISK_PATH, "utf8");
    const data = JSON.parse(raw) as CatalogModel[];
    return Array.isArray(data) && data.length > 0 ? data : null;
  } catch {
    return null;
  }
}

function writeDisk(data: CatalogModel[]): void {
  try {
    fs.mkdirSync(path.dirname(DISK_PATH), { recursive: true });
    fs.writeFileSync(DISK_PATH, JSON.stringify(data));
  } catch {
    // Persistence is best-effort; memory cache still works
  }
}

export async function getCatalog(): Promise<CatalogModel[]> {
  if (memCache && Date.now() - memCache.fetchedAt < TTL_MS) {
    return memCache.data;
  }

  try {
    const data = await fetchWithRetry();
    memCache = { data, fetchedAt: Date.now() };
    writeDisk(data);
    return data;
  } catch (error) {
    // Stale beats nothing: expired memory first, then last good disk copy
    if (memCache) return memCache.data;
    const disk = readDisk();
    if (disk) {
      memCache = { data: disk, fetchedAt: 0 };
      return disk;
    }
    throw error;
  }
}
