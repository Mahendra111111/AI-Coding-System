import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export interface SystemConfig {
  systemRoot: string;
  projectRoots: string[];
  identity: { hashLength: number };
  graphify: { enabled: boolean; preferCodeOnly: boolean };
  telemetry: { enabled: boolean };
}

const DEFAULT_CONFIG: SystemConfig = {
  systemRoot: "C:\\AI-Coding-System",
  projectRoots: ["D:\\"],
  identity: { hashLength: 20 },
  graphify: { enabled: true, preferCodeOnly: true },
  telemetry: { enabled: false },
};

function resolveSystemRoot(): string {
  const fromEnv = process.env.AI_CODING_SYSTEM_ROOT;
  if (fromEnv) return fromEnv;
  const here = dirname(fileURLToPath(import.meta.url));
  // src/core -> repo root (dev) or dist/core -> repo root (built)
  return join(here, "..", "..");
}

export function loadConfig(): SystemConfig {
  const root = resolveSystemRoot();
  const configPath = join(root, "config", "system.json");
  if (!existsSync(configPath)) {
    return { ...DEFAULT_CONFIG, systemRoot: root };
  }
  const raw = JSON.parse(readFileSync(configPath, "utf8")) as Partial<SystemConfig>;
  return {
    ...DEFAULT_CONFIG,
    ...raw,
    systemRoot: raw.systemRoot ?? root,
    identity: { ...DEFAULT_CONFIG.identity, ...raw.identity },
    graphify: { ...DEFAULT_CONFIG.graphify, ...raw.graphify },
    telemetry: { ...DEFAULT_CONFIG.telemetry, ...raw.telemetry },
  };
}
