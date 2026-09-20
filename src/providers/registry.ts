import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { SystemConfig } from "../core/config.js";
import { providersDir } from "../core/paths.js";
import type { ProviderRegistry } from "./types.js";

export function providerRegistryPath(config: SystemConfig): string {
  return join(providersDir(config), "registry.json");
}

export function loadProviderRegistry(config: SystemConfig): ProviderRegistry {
  const path = providerRegistryPath(config);
  if (!existsSync(path)) {
    throw new Error(`Provider registry not found: ${path}`);
  }
  return JSON.parse(readFileSync(path, "utf8")) as ProviderRegistry;
}
