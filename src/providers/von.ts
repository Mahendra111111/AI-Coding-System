import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { VonClient, choice, noul } from "von-sdk";
import type {
  ChoiceAnswer,
  Question,
  SystemOneResponse,
} from "von-sdk";
import type { SystemConfig } from "../core/config.js";

export const VON_INSTALL_HINT =
  "pip install git+https://github.com/wfzyx/von.git (ACS auto-starts von serve when von.autoStart=true)";

const REQUEST_TIMEOUT_MS = 120_000;
const HEALTH_TIMEOUT_MS = 3_000;
const AUTO_START_WAIT_MS = 90_000;
const AUTO_START_POLL_MS = 1_500;

let startInFlight: Promise<boolean> | null = null;

export function vonBaseUrl(config: SystemConfig): string {
  const fromEnv = process.env.VON_BASE_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  return (config.von.baseUrl || "http://127.0.0.1:8000").replace(/\/+$/, "");
}

function disabledMessage(): string {
  return "Von decision routing is disabled in config (von.enabled=false).";
}

export function unavailableMessage(baseUrl: string, error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error);
  return [
    `Von server is unavailable at ${baseUrl}: ${detail}`,
    configAutoStartHint(),
    "Override the URL with VON_BASE_URL or config.von.baseUrl.",
  ].join("\n");
}

function configAutoStartHint(): string {
  return `Install: pip install git+https://github.com/wfzyx/von.git. With von.autoStart=true ACS starts the server on first decide_tools call; or run: npm run von:serve`;
}

function createClient(config: SystemConfig): VonClient {
  return new VonClient({
    baseURL: vonBaseUrl(config),
    timeout: REQUEST_TIMEOUT_MS,
  });
}

function parseHostPort(baseUrl: string): { host: string; port: string } {
  try {
    const u = new URL(baseUrl);
    return {
      host: u.hostname || "127.0.0.1",
      port: u.port || "8000",
    };
  } catch {
    return { host: "127.0.0.1", port: "8000" };
  }
}

/** Fast liveness check (GET /). Does not load the model. */
export async function isVonListening(baseUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/`, {
      method: "GET",
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    });
    return response.status > 0;
  } catch {
    return false;
  }
}

export function resolveVonExecutable(): string | null {
  const candidates = [
    join(
      process.env.APPDATA || join(homedir(), "AppData", "Roaming"),
      "Python",
      "Python314",
      "Scripts",
      "von.exe",
    ),
    join(
      process.env.APPDATA || join(homedir(), "AppData", "Roaming"),
      "Python",
      "Python313",
      "Scripts",
      "von.exe",
    ),
    join(
      process.env.LOCALAPPDATA || join(homedir(), "AppData", "Local"),
      "Programs",
      "Python",
      "Python314",
      "Scripts",
      "von.exe",
    ),
  ];
  for (const path of candidates) {
    if (existsSync(path)) return path;
  }
  return null;
}

function spawnVonServer(config: SystemConfig): boolean {
  const vonExe = resolveVonExecutable();
  if (!vonExe) return false;

  const { host, port } = parseHostPort(vonBaseUrl(config));
  const model = config.von.model || "von-1.1";
  const child = spawn(
    vonExe,
    ["serve", "--model", model, "--port", port, "--host", host],
    {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
      env: {
        ...process.env,
        HF_HUB_DISABLE_SYMLINKS_WARNING: "1",
      },
    },
  );
  child.unref();
  return true;
}

async function waitForVon(baseUrl: string, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isVonListening(baseUrl)) return true;
    await new Promise((r) => setTimeout(r, AUTO_START_POLL_MS));
  }
  return isVonListening(baseUrl);
}

/**
 * Like Caveman for UX: agent just calls decide_tools — ACS ensures Von is up.
 * Unlike Caveman (text-only), Von is a real model and still needs a background process;
 * we start it automatically when autoStart is enabled.
 */
export async function ensureVonRunning(
  config: SystemConfig,
): Promise<{ ok: boolean; detail: string }> {
  if (!config.von.enabled) {
    return { ok: false, detail: disabledMessage() };
  }

  const base = vonBaseUrl(config);
  if (await isVonListening(base)) {
    return { ok: true, detail: `already running at ${base}` };
  }

  if (!config.von.autoStart) {
    return {
      ok: false,
      detail: `Von not listening at ${base}; set von.autoStart=true or run: npm run von:serve`,
    };
  }

  if (!startInFlight) {
    startInFlight = (async () => {
      try {
        if (await isVonListening(base)) return true;
        const spawned = spawnVonServer(config);
        if (!spawned) return false;
        return waitForVon(base, AUTO_START_WAIT_MS);
      } finally {
        startInFlight = null;
      }
    })();
  }

  const ok = await startInFlight;
  if (ok) {
    return { ok: true, detail: `auto-started at ${base}` };
  }
  return {
    ok: false,
    detail: `auto-start failed for ${base}; install von and retry, or run: npm run von:serve`,
  };
}

export async function probeVon(
  config: SystemConfig,
): Promise<{ available: boolean; detail: string }> {
  const base = vonBaseUrl(config);
  if (await isVonListening(base)) {
    return { available: true, detail: `Server reachable at ${base}` };
  }
  if (config.von.autoStart && resolveVonExecutable()) {
    return {
      available: true,
      detail: `Client ready; will auto-start on decide_tools (${base})`,
    };
  }
  return {
    available: false,
    detail: `Server missing at ${base}; ${configAutoStartHint()}`,
  };
}

export type VonSystemOneResult =
  | { ok: true; response: SystemOneResponse }
  | { ok: false; error: string };

async function withVonReady(
  config: SystemConfig,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!config.von.enabled) {
    return { ok: false, error: disabledMessage() };
  }
  const ensured = await ensureVonRunning(config);
  if (!ensured.ok) {
    return { ok: false, error: ensured.detail };
  }
  return { ok: true };
}

export async function vonSystemOne(
  config: SystemConfig,
  state: string,
  questions: Record<string, Question>,
): Promise<VonSystemOneResult> {
  const ready = await withVonReady(config);
  if (!ready.ok) return ready;

  const base = vonBaseUrl(config);
  try {
    const response = await createClient(config).systemOne({ state, questions });
    return { ok: true, response };
  } catch (error) {
    return { ok: false, error: unavailableMessage(base, error) };
  }
}

export async function vonDecide(
  config: SystemConfig,
  state: string,
  choices: Record<string, string>,
  instructions?: string,
): Promise<{ ok: true; answer: ChoiceAnswer } | { ok: false; error: string }> {
  const ready = await withVonReady(config);
  if (!ready.ok) return ready;

  const base = vonBaseUrl(config);
  try {
    const answer = await createClient(config).decide(
      state,
      choices,
      instructions,
    );
    return { ok: true, answer };
  } catch (error) {
    return { ok: false, error: unavailableMessage(base, error) };
  }
}

export async function vonJudge(
  config: SystemConfig,
  state: string,
  question: string,
): Promise<{ ok: true; noul: number } | { ok: false; error: string }> {
  const ready = await withVonReady(config);
  if (!ready.ok) return ready;

  const base = vonBaseUrl(config);
  try {
    const noulValue = await createClient(config).judge(state, question);
    return { ok: true, noul: noulValue };
  } catch (error) {
    return { ok: false, error: unavailableMessage(base, error) };
  }
}

export { choice, noul };
