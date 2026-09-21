import type { SystemConfig } from "../core/config.js";

/**
 * Output-compression guidance provider (agent terse-output via compression_guidance).
 * Context Mode is a separate role (tool-context-control / peer MCP) and may coexist.
 */
export type CompressionProvider = "caveman" | "context-mode" | "none";

export function activeCompressionProvider(
  config: SystemConfig,
): CompressionProvider {
  // Output-compression path: Caveman guidance when enabled.
  if (config.caveman.enabled) return "caveman";
  // Legacy label only when Caveman is off and Context Mode is the sole policy flag.
  if (config.contextMode.enabled) return "context-mode";
  return "none";
}

export function assertCompressionPolicy(config: SystemConfig): {
  ok: boolean;
  detail: string;
} {
  const toolContext = config.contextMode.enabled
    ? "tool-context: context-mode"
    : "tool-context: off";
  const outputCompression = config.caveman.enabled
    ? "output-compression: caveman"
    : "output-compression: off";

  return {
    ok: true,
    detail: `${toolContext}; ${outputCompression}`,
  };
}
