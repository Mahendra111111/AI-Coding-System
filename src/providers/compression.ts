import type { SystemConfig } from "../core/config.js";

export type CompressionProvider = "context-mode" | "caveman" | "none";

export function activeCompressionProvider(
  config: SystemConfig,
): CompressionProvider {
  if (config.contextMode.enabled) return "context-mode";
  if (config.caveman.enabled) return "caveman";
  return "none";
}

export function assertCompressionPolicy(config: SystemConfig): {
  ok: boolean;
  detail: string;
} {
  if (config.contextMode.enabled && config.caveman.enabled) {
    return {
      ok: false,
      detail:
        "overlap: contextMode and caveman both enabled — disable one; active path uses context-mode",
    };
  }
  const active = activeCompressionProvider(config);
  return { ok: true, detail: `active compression: ${active}` };
}
