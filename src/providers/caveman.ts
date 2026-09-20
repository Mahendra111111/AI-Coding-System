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
    return "Context-mode is active; caveman compression is off. ACS uses context-mode for tool-output compression. Enable caveman only with contextMode disabled (mutually exclusive).";
  }

  return "No compression provider active; caveman is off. Enable context-mode (preferred) or caveman in config/system.json — not both.";
}
