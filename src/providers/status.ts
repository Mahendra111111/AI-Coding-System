import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import type { SystemConfig } from "../core/config.js";
import { listProjects } from "../project/register.js";
import { assertCompressionPolicy } from "./compression.js";
import { loadProviderRegistry } from "./registry.js";
import type { ProviderEntry, ProviderRole } from "./types.js";
import { cliAvailable, projectLocalCli } from "./which.js";

export interface ProviderStatusRow {
  id: string;
  role: ProviderRole;
  enabledInConfig: boolean;
  available: boolean;
  detail: string;
}

const QUALITY_PROVIDER_IDS = new Set(["prettier", "eslint"]);

function enabledInConfig(config: SystemConfig, id: string): boolean {
  switch (id) {
    case "graphify":
      return config.graphify.enabled;
    case "claude-mem":
      return config.memory.enabled;
    case "ponytail":
      return config.ponytail.enabled;
    case "caveman":
      return config.caveman.enabled;
    case "context-mode":
      return config.contextMode.enabled;
    case "open-code-review":
      return config.review.openCodeReview.enabled;
    case "semgrep":
      return config.security.semgrep.enabled;
    case "codeql":
      return config.security.codeql.enabled;
    default:
      return true;
  }
}

function claudeMemDataDir(): string {
  return (
    process.env.CLAUDE_MEM_DATA_DIR || join(homedir(), ".claude-mem")
  ).replace(/\/+$/, "");
}

function claudeMemWorkerBaseUrl(): string {
  const fromEnv = process.env.CLAUDE_MEM_WORKER_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, "");

  const settingsPath = join(claudeMemDataDir(), "settings.json");
  if (existsSync(settingsPath)) {
    try {
      const settings = JSON.parse(readFileSync(settingsPath, "utf8")) as {
        CLAUDE_MEM_WORKER_HOST?: string;
        CLAUDE_MEM_WORKER_PORT?: string | number;
      };
      const host = settings.CLAUDE_MEM_WORKER_HOST || "127.0.0.1";
      const port = String(settings.CLAUDE_MEM_WORKER_PORT || "37777");
      return `http://${host}:${port}`;
    } catch {
      // fall through to default
    }
  }
  return "http://127.0.0.1:37777";
}

function probeClaudeMem(): { available: boolean; detail: string } {
  const dataDir = claudeMemDataDir();
  const settingsPath = join(dataDir, "settings.json");
  const installed =
    existsSync(settingsPath) ||
    existsSync(join(dataDir, "claude-mem.db")) ||
    existsSync(join(dataDir, "supervisor.json"));

  if (!installed) {
    return {
      available: false,
      detail:
        "Install missing; run: npx claude-mem install --provider host",
    };
  }

  return {
    available: true,
    detail: `Installed at ${dataDir}; worker URL ${claudeMemWorkerBaseUrl()} (start with: npx claude-mem start)`,
  };
}

function probeContextMode(): { available: boolean; detail: string } {
  if (cliAvailable("context-mode")) {
    return {
      available: true,
      detail: "CLI available: context-mode",
    };
  }

  const npmRootCandidates = [
    join(process.env.APPDATA || "", "npm", "node_modules", "context-mode"),
    join(
      process.env.APPDATA || "",
      "npm",
      "node_modules",
      "context-mode",
      "package.json",
    ),
  ];
  if (
    npmRootCandidates.some((candidate) => existsSync(candidate)) ||
    existsSync(join(process.env.APPDATA || "", "npm", "context-mode.cmd"))
  ) {
    return {
      available: true,
      detail: "Global npm package context-mode present",
    };
  }

  return {
    available: false,
    detail: "CLI missing: context-mode; install: npm install -g context-mode",
  };
}

function workspaceProbeRoots(workspacePath: string): string[] {
  const roots = [workspacePath];
  for (const sub of ["apps", "packages"]) {
    const parent = join(workspacePath, sub);
    if (!existsSync(parent)) continue;
    try {
      for (const entry of readdirSync(parent, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          roots.push(join(parent, entry.name));
        }
      }
    } catch {
      // ignore unreadable monorepo dirs
    }
  }
  return roots;
}

function probeQualityCli(
  config: SystemConfig,
  cli: string,
): { available: boolean; detail: string } {
  if (cliAvailable(cli)) {
    return { available: true, detail: `CLI available on PATH: ${cli}` };
  }

  const hits: string[] = [];
  for (const project of listProjects(config)) {
    if (!existsSync(project.workspacePath)) continue;
    for (const root of workspaceProbeRoots(project.workspacePath)) {
      const local = projectLocalCli(root, cli);
      if (local) {
        hits.push(`${project.projectName}:${root}`);
        break;
      }
    }
  }

  if (hits.length > 0) {
    return {
      available: true,
      detail: `Project-local CLI found (${cli}): ${hits.slice(0, 3).join(", ")}`,
    };
  }

  return {
    available: false,
    detail: `CLI missing: ${cli}; install in a registered project (node_modules/.bin) or on PATH`,
  };
}

function availability(
  config: SystemConfig,
  provider: ProviderEntry,
): { available: boolean; detail: string } {
  switch (provider.id) {
    case "claude-mem":
      return probeClaudeMem();
    case "context-mode":
      return probeContextMode();
    default:
      break;
  }

  if (QUALITY_PROVIDER_IDS.has(provider.id) && provider.cli) {
    return probeQualityCli(config, provider.cli);
  }

  if (provider.cli) {
    const toolDirs = [join(config.systemRoot, "tools", provider.cli)];
    const available = cliAvailable(provider.cli, toolDirs);
    return {
      available,
      detail: available
        ? `CLI available: ${provider.cli}`
        : `CLI missing: ${provider.cli}; install: ${provider.install}`,
    };
  }

  if (provider.checkout) {
    const checkout = resolve(config.systemRoot, provider.checkout);
    const available = existsSync(checkout);
    return {
      available,
      detail: available
        ? `Checkout available: ${checkout}`
        : `Checkout missing: ${checkout}; install: ${provider.install}`,
    };
  }

  return {
    available: false,
    detail: `No local availability probe; install: ${provider.install}`,
  };
}

function roleStatusDetail(
  providerId: string,
  enabled: boolean,
  availabilityDetail: string,
  compressionDetail: string,
): string {
  switch (providerId) {
    case "caveman":
      return enabled
        ? `enabled; ${availabilityDetail}; ${compressionDetail}`
        : `standby (intentional); ${availabilityDetail}; ${compressionDetail} — enable caveman.enabled for output-compression guidance`;
    case "context-mode":
      return enabled
        ? `enabled; ${availabilityDetail}; ${compressionDetail}`
        : `disabled; ${availabilityDetail}; ${compressionDetail}`;
    default:
      return `${enabled ? "enabled" : "disabled"}; ${availabilityDetail}`;
  }
}

export function getAllProviderStatuses(
  config: SystemConfig,
): ProviderStatusRow[] {
  const compressionPolicy = assertCompressionPolicy(config);

  return loadProviderRegistry(config).providers.map((provider) => {
    const enabled = enabledInConfig(config, provider.id);
    const status = availability(config, provider);
    const compressionDetail =
      provider.id === "context-mode" || provider.id === "caveman"
        ? compressionPolicy.detail
        : "";

    return {
      id: provider.id,
      role: provider.role,
      enabledInConfig: enabled,
      available: status.available,
      detail: roleStatusDetail(
        provider.id,
        enabled,
        status.detail,
        compressionDetail,
      ),
    };
  });
}
