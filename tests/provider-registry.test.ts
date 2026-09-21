import { describe, it, expect } from "vitest";
import { loadConfig } from "../src/core/config.js";
import {
  providersDir,
  reviewsDir,
  tempSessionDir,
} from "../src/core/paths.js";
import { loadProviderRegistry } from "../src/providers/registry.js";
import { cliAvailable } from "../src/providers/which.js";

const EXPECTED_IDS = [
  "graphify",
  "claude-mem",
  "ponytail",
  "caveman",
  "context-mode",
  "open-code-review",
  "anthropic-skills",
  "owasp-scp",
  "owasp-top10",
  "semgrep",
  "codeql",
  "prettier",
  "eslint",
] as const;

describe("provider registry", () => {
  it("loads registry and lists all provider ids", () => {
    const config = loadConfig();
    const registry = loadProviderRegistry(config);
    const ids = registry.providers.map((p) => p.id);
    expect(ids).toEqual([...EXPECTED_IDS]);
  });

  it("exposes provider path helpers", () => {
    const config = loadConfig();
    expect(providersDir(config)).toMatch(/providers$/);
    expect(reviewsDir(config, "abc123")).toMatch(/projects[/\\]abc123[/\\]reviews$/);
    expect(tempSessionDir(config, "abc123", "sess-1")).toMatch(
      /projects[/\\]abc123[/\\]temp[/\\]sess-1$/,
    );
  });

  it("checks cli availability without throwing", () => {
    const available = cliAvailable("node");
    expect(typeof available).toBe("boolean");
  });
});
