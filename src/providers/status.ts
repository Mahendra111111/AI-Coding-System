import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { SystemConfig } from "../core/config.js";
import { assertCompressionPolicy } from "./compression.js";
import { loadProviderRegistry } from "./registry.js";
import type { ProviderEntry, ProviderRole } from "./types.js";
import { cliAvailable } from "./which.js";

export interface ProviderStatusRow {
  id: string;
  role: ProviderRole;
  enabledInConfig: boolean;
  available: boolean;
  detail: string;
}

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
    case "bearer":
      return config.security.bearer.enabled;
    default:
      return true;
  }
}

function availability(
  config: SystemConfig,
  provider: ProviderEntry,
): { available: boolean; detail: string } {
  if (provider.cli) {
    const available = cliAvailable(provider.cli);
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

export function getAllProviderStatuses(
  config: SystemConfig,
): ProviderStatusRow[] {
  const compressionPolicy = assertCompressionPolicy(config);

  return loadProviderRegistry(config).providers.map((provider) => {
    const enabled = enabledInConfig(config, provider.id);
    const status = availability(config, provider);
    const compressionDetail =
      provider.id === "context-mode" || provider.id === "caveman"
        ? `; ${compressionPolicy.detail}`
        : "";

    return {
      id: provider.id,
      role: provider.role,
      enabledInConfig: enabled,
      available: status.available,
      detail: `${enabled ? "enabled" : "disabled"}; ${status.detail}${compressionDetail}`,
    };
  });
}
