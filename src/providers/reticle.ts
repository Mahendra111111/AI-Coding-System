import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { SystemConfig } from "../core/config.js";
import { skillsDir } from "../core/paths.js";
import { cliAvailable } from "./which.js";

const RETICLE_INSTALL =
  "npm install -g @reticlehq/server; npx @reticlehq/server setup mcp; per app: npx @reticlehq/server init";

export function probeReticle(): { available: boolean; detail: string } {
  if (cliAvailable("reticle")) {
    return { available: true, detail: "CLI available: reticle" };
  }

  const reticleHome = join(homedir(), ".reticle");
  if (existsSync(reticleHome)) {
    return {
      available: true,
      detail: `Config present at ${reticleHome}; peer MCP: npx @reticlehq/server mcp`,
    };
  }

  return {
    available: false,
    detail: `Reticle not detected; install: ${RETICLE_INSTALL}`,
  };
}

export function getReticleGuidance(config: SystemConfig): string {
  if (!config.reticle.enabled) {
    return "Reticle guidance is disabled in config (reticle.enabled=false).";
  }

  const skillPath = join(skillsDir(config), "reticle", "SKILL.md");
  const probe = probeReticle();
  const header = [
    "Reticle is a peer MCP (not proxied through ACS).",
    `Status: ${probe.available ? "available" : "missing"} — ${probe.detail}`,
    "Register once: npx @reticlehq/server setup mcp (or machine installer).",
    "Per owned app: npx @reticlehq/server init (dev-only SDK).",
    "",
  ].join("\n");

  if (existsSync(skillPath)) {
    try {
      return `${header}${readFileSync(skillPath, "utf8")}`;
    } catch {
      // fall through
    }
  }

  return `${header}Skill file missing at ${skillPath}. See docs/PROVIDERS.md.`;
}
