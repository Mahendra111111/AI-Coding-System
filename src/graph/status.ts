import { loadConfig } from "../core/config.js";
import { isGraphifyAvailable } from "../graph/graphify.js";

/** Used by tests to assert optional Graphify tooling detection. */
export function graphifyStatus(): { available: boolean; hint: string } {
  const available = isGraphifyAvailable();
  return {
    available,
    hint: available
      ? "graphify CLI ready"
      : "Install with: uv tool install graphifyy",
  };
}

export function graphifyEnabledInConfig(): boolean {
  return loadConfig().graphify.enabled;
}
