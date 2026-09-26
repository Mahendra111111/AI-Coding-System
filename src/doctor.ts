import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { SystemConfig } from "./core/config.js";
import { isGraphifyAvailable } from "./graph/graphify.js";
import { projectsDir, registryPath, templatesDir } from "./core/paths.js";
import { getAllProviderStatuses } from "./providers/status.js";
import { resolveVonExecutable } from "./providers/von.js";

export interface DoctorCheck {
  name: string;
  ok: boolean;
  detail: string;
}

const INSTALL_REMEDIATION =
  "If anything is missing, re-run one command only: powershell -ExecutionPolicy Bypass -File <ACS_ROOT>\\install.ps1";

function which(cmd: string): boolean {
  const result = spawnSync(cmd, ["--version"], {
    encoding: "utf8",
    windowsHide: true,
    timeout: 5_000,
  });
  if (result.status === 0) return true;
  const where = spawnSync("where.exe", [cmd], {
    encoding: "utf8",
    windowsHide: true,
    timeout: 5_000,
  });
  return where.status === 0;
}

export function runDoctor(config: SystemConfig): {
  ok: boolean;
  checks: DoctorCheck[];
  summary: string;
  remediation: string;
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
      : `Missing ${distEntry} — run install.ps1 (or npm run build)`,
  });

  const cliOk = which("ai-coding-mcp");
  checks.push({
    name: "acs_cli",
    ok: cliOk,
    detail: cliOk
      ? "ai-coding-mcp on PATH"
      : "ai-coding-mcp not on PATH — run install.ps1 (npm link)",
  });

  const doctorCliOk = which("acs-doctor");
  checks.push({
    name: "acs_doctor_cli",
    ok: doctorCliOk || cliOk,
    detail: doctorCliOk
      ? "acs-doctor on PATH"
      : cliOk
        ? "acs-doctor optional; ai-coding-mcp present"
        : "acs-doctor not on PATH — run install.ps1",
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
        ? "optional — not installed (re-run install.ps1)"
        : "disabled in config",
  });

  const vonExe = resolveVonExecutable();
  checks.push({
    name: "von_cli",
    ok: Boolean(vonExe) || which("von") || !config.von.enabled,
    detail: vonExe || which("von")
      ? `von CLI available${vonExe ? `: ${vonExe}` : ""}`
      : config.von.enabled
        ? "optional — von not found (re-run install.ps1)"
        : "disabled in config",
  });

  const codeqlLocal = existsSync(join(config.systemRoot, "tools", "codeql", "codeql.exe"));
  const codeqlPath = which("codeql");
  checks.push({
    name: "codeql",
    ok: codeqlLocal || codeqlPath || !config.security.codeql.enabled,
    detail: codeqlLocal
      ? `CodeQL at ${join(config.systemRoot, "tools", "codeql")}`
      : codeqlPath
        ? "codeql on PATH"
        : config.security.codeql.enabled
          ? "optional — not installed (re-run install.ps1 without -SkipHeavy)"
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

  // Optional providers / CLIs don't fail overall health.
  const requiredFailed = checks.filter(
    (c) =>
      !c.ok &&
      c.name !== "graphify" &&
      c.name !== "von_cli" &&
      c.name !== "codeql" &&
      c.name !== "acs_cli" &&
      c.name !== "acs_doctor_cli" &&
      c.name !== "provider_registry" &&
      !c.name.startsWith("provider:"),
  );
  const ok = requiredFailed.length === 0;
  const anyGap = checks.some((c) => !c.ok);
  const summary = checks
    .map((c) => `${c.ok ? "OK" : "WARN"}  ${c.name}: ${c.detail}`)
    .join("\n");

  return {
    ok,
    checks,
    summary,
    remediation: anyGap
      ? INSTALL_REMEDIATION.replace("<ACS_ROOT>", config.systemRoot)
      : INSTALL_REMEDIATION.replace(
          "If anything is missing, re-run one command only: ",
          "Full potential install command: ",
        ).replace("<ACS_ROOT>", config.systemRoot),
  };
}
