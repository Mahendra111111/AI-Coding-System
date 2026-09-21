import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export type SecurityPolicy = "light" | "normal" | "deep";

export interface SystemConfig {
  systemRoot: string;
  projectRoots: string[];
  identity: { hashLength: number };
  graphify: { enabled: boolean; preferCodeOnly: boolean };
  memory: { enabled: boolean; provider: "claude-mem" };
  ponytail: { enabled: boolean };
  caveman: { enabled: boolean };
  contextMode: { enabled: boolean };
  review: { openCodeReview: { enabled: boolean } };
  security: {
    semgrep: { enabled: boolean };
    codeql: { enabled: boolean };
    defaultPolicy: SecurityPolicy;
  };
  validation: { maxBuildAttempts: number };
  telemetry: { enabled: boolean };
}

const DEFAULT_CONFIG: SystemConfig = {
  systemRoot: "C:\\AI-Coding-System",
  projectRoots: ["D:\\"],
  identity: { hashLength: 20 },
  graphify: { enabled: true, preferCodeOnly: true },
  memory: { enabled: true, provider: "claude-mem" },
  ponytail: { enabled: true },
  caveman: { enabled: true },
  contextMode: { enabled: true },
  review: { openCodeReview: { enabled: true } },
  security: {
    semgrep: { enabled: true },
    codeql: { enabled: false },
    defaultPolicy: "light",
  },
  validation: { maxBuildAttempts: 3 },
  telemetry: { enabled: false },
};

function resolveSystemRoot(): string {
  const fromEnv = process.env.AI_CODING_SYSTEM_ROOT;
  if (fromEnv) return fromEnv;
  const here = dirname(fileURLToPath(import.meta.url));
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
    memory: { ...DEFAULT_CONFIG.memory, ...raw.memory },
    ponytail: { ...DEFAULT_CONFIG.ponytail, ...raw.ponytail },
    caveman: { ...DEFAULT_CONFIG.caveman, ...raw.caveman },
    contextMode: { ...DEFAULT_CONFIG.contextMode, ...raw.contextMode },
    review: {
      openCodeReview: {
        ...DEFAULT_CONFIG.review.openCodeReview,
        ...raw.review?.openCodeReview,
      },
    },
    security: {
      ...DEFAULT_CONFIG.security,
      ...raw.security,
      semgrep: { ...DEFAULT_CONFIG.security.semgrep, ...raw.security?.semgrep },
      codeql: { ...DEFAULT_CONFIG.security.codeql, ...raw.security?.codeql },
    },
    validation: { ...DEFAULT_CONFIG.validation, ...raw.validation },
    telemetry: { ...DEFAULT_CONFIG.telemetry, ...raw.telemetry },
  };
}
