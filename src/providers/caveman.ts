import type { SystemConfig } from "../core/config.js";
import { activeCompressionProvider } from "./compression.js";

const CAVEMAN_GUIDANCE = `Caveman compression active (ACS guidance)

Respond terse: drop filler, hedging, and pleasantries; fragments OK. Keep code blocks, commands, paths, and error messages byte-for-byte exact.

Never compress: security warnings, irreversible actions, or technical substance.
Levels: lite (tight sentences), full (classic caveman), ultra (maximum terseness).
Caveman shrinks what the agent says; pair with Ponytail discipline_rules for what it builds.`;

export function getCavemanGuidance(config: SystemConfig): string {
  const active = activeCompressionProvider(config);

  if (active === "caveman") {
    return CAVEMAN_GUIDANCE;
  }

  if (active === "context-mode") {
    return "Context Mode is the preferred compression policy; caveman is off. ACS currently selects this policy label but does not invoke or proxy Context Mode. Configure and invoke the Context Mode MCP separately until ACS adds proxy support. Enable caveman only with contextMode disabled (mutually exclusive).";
  }

  return "No compression policy active; caveman is off. Enable Context Mode (preferred policy; invoke its MCP separately) or caveman in config/system.json — not both.";
}
