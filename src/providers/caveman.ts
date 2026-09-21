import type { SystemConfig } from "../core/config.js";
import { activeCompressionProvider } from "./compression.js";

const CAVEMAN_GUIDANCE = `Caveman output-compression active (ACS guidance)

Respond terse: drop filler, hedging, and pleasantries; fragments OK. Keep code blocks, commands, paths, and error messages byte-for-byte exact.

Never compress: security warnings, irreversible actions, or technical substance.
Levels: lite (tight sentences), full (classic caveman), ultra (maximum terseness).
Caveman shrinks what the agent says; pair with Ponytail discipline_rules for what it builds.

Context Mode (when enabled) remains separate for tool-context control as a peer MCP — ACS does not invoke or proxy it.`;

export function getCavemanGuidance(config: SystemConfig): string {
  const active = activeCompressionProvider(config);

  if (active === "caveman") {
    return CAVEMAN_GUIDANCE;
  }

  if (active === "context-mode") {
    return "Context Mode is enabled for tool-context control (peer MCP; ACS does not invoke or proxy it). Caveman output-compression is off — set caveman.enabled=true in config/system.json to activate terse-output guidance. Both may be enabled together (separate roles).";
  }

  return "No output-compression or tool-context policy active. Enable contextMode (tool-context peer MCP) and/or caveman (output-compression guidance) in config/system.json.";
}
