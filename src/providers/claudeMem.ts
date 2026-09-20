import type { SystemConfig } from "../core/config.js";

const DEFAULT_WORKER_URL = "http://127.0.0.1:37777";
const INSTALL_COMMAND = "npx claude-mem install --provider host";
const REQUEST_TIMEOUT_MS = 10_000;

function workerUrl(): string {
  return (process.env.CLAUDE_MEM_WORKER_URL || DEFAULT_WORKER_URL).replace(
    /\/+$/,
    "",
  );
}

function disabledMessage(): string {
  return "Claude-Mem memory is disabled in config (memory.enabled=false).";
}

function unavailableMessage(error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error);
  return [
    `Claude-Mem worker is unavailable at ${workerUrl()}: ${detail}`,
    `Install/start it with: ${INSTALL_COMMAND}`,
    "If its worker uses another port, set CLAUDE_MEM_WORKER_URL to the active worker base URL.",
  ].join("\n");
}

async function request(url: string, init?: RequestInit): Promise<string> {
  try {
    const response = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`.trim());
    }
    return await response.text();
  } catch (error) {
    return unavailableMessage(error);
  }
}

export async function memorySearch(
  config: SystemConfig,
  query: string,
  limit = 10,
): Promise<string> {
  if (!config.memory.enabled) return disabledMessage();

  const params = new URLSearchParams({
    query,
    type: "observations",
    format: "index",
    limit: String(limit),
  });
  return request(`${workerUrl()}/api/search?${params.toString()}`);
}

export async function memoryGet(
  config: SystemConfig,
  ids: number[],
): Promise<string> {
  if (!config.memory.enabled) return disabledMessage();
  if (ids.length === 0) {
    return "No Claude-Mem observation IDs requested.";
  }

  return request(`${workerUrl()}/api/observations/batch`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ids }),
  });
}
