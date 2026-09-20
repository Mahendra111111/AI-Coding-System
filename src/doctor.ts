import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { SystemConfig } from "./core/config.js";
import { isGraphifyAvailable } from "./graph/graphify.js";
import { projectsDir, registryPath, templatesDir } from "./core/paths.js";
import { getAllProviderStatuses } from "./providers/status.js";

export interface DoctorCheck {
  name: string;
  ok: boolean;
  detail: string;
}

function which(cmd: string): boolean {
  const result = spawnSync(cmd, ["--version"], {
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.status === 0) return true;
  const where = spawnSync("where.exe", [cmd], {
    encoding: "utf8",
    windowsHide: true,
  });
  return where.status === 0;
}

export function runDoctor(config: SystemConfig): {
  ok: boolean;
  checks: DoctorCheck[];
  summary: string;
} {
  const checks: DoctorCheck[] = [];

  checks.push({
    name: "node",
    ok: true,
    detail: `Node ${process.version}`,
  });

  checks.push({
    name: "git",
    ok: which("git"),
    detail: which("git") ? "git available" : "git not found on PATH",
  });

  const distEntry = join(config.systemRoot, "dist", "index.js");
  checks.push({
    name: "mcp_build",
    ok: existsSync(distEntry),
    detail: existsSync(distEntry)
      ? `Built entry: ${distEntry}`
      : `Missing ${distEntry} — run npm run build`,
  });

  checks.push({
    name: "templates",
    ok: existsSync(join(templatesDir(config), "PROJECT_STATE.md")),
    detail: templatesDir(config),
  });

  checks.push({
    name: "projects_dir",
    ok: true,
    detail: projectsDir(config),
  });

  checks.push({
    name: "registry",
    ok: true,
    detail: existsSync(registryPath(config))
      ? `Registry exists: ${registryPath(config)}`
      : `Registry will be created at: ${registryPath(config)}`,
  });

  const graphifyOk = isGraphifyAvailable();
  checks.push({
    name: "graphify",
    ok: graphifyOk || !config.graphify.enabled,
    detail: graphifyOk
      ? "graphify CLI available"
      : config.graphify.enabled
        ? "optional — not installed (uv tool install graphifyy)"
        : "disabled in config",
  });

  try {
    const providerChecks = getAllProviderStatuses(config).map((provider) => ({
      name: `provider:${provider.id}`,
      ok:
        !provider.enabledInConfig ||
        (provider.available && !provider.detail.includes("overlap:")),
      detail: provider.detail,
    }));
    checks.push(...providerChecks);
  } catch (error) {
    checks.push({
      name: "provider_registry",
      ok: false,
      detail: `optional provider status unavailable: ${error instanceof Error ? error.message : String(error)}`,
    });
  }

  // Optional providers, including graphify, don't fail overall health.
  const requiredFailed = checks.filter(
    (c) =>
      !c.ok &&
      c.name !== "graphify" &&
      c.name !== "provider_registry" &&
      !c.name.startsWith("provider:"),
  );
  const ok = requiredFailed.length === 0;
  const summary = checks
    .map((c) => `${c.ok ? "OK" : "WARN"}  ${c.name}: ${c.detail}`)
    .join("\n");

  return { ok, checks, summary };
}
