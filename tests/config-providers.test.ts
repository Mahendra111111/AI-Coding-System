import { describe, it, expect } from "vitest";
import { loadConfig } from "../src/core/config.js";

describe("provider config", () => {
  it("loads memory, contextMode, caveman, review, security, validation defaults", () => {
    const config = loadConfig();
    expect(config.memory.enabled).toBe(true);
    expect(config.memory.provider).toBe("claude-mem");
    expect(config.contextMode.enabled).toBe(true);
    expect(config.caveman.enabled).toBe(false);
    expect(config.ponytail.enabled).toBe(true);
    expect(config.review.openCodeReview.enabled).toBe(true);
    expect(config.security.semgrep.enabled).toBe(true);
    expect(config.security.codeql.enabled).toBe(false);
    expect(config.security.bearer.enabled).toBe(false);
    expect(config.security.defaultPolicy).toBe("light");
    expect(config.validation.maxBuildAttempts).toBe(3);
  });
});
