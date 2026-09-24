import { describe, it, expect } from "vitest";
import { loadConfig } from "../src/core/config.js";

describe("provider config", () => {
  it("loads memory, contextMode, caveman, review, von, reticle, nextSeo, security, validation defaults", () => {
    const config = loadConfig();
    expect(config.memory.enabled).toBe(true);
    expect(config.memory.provider).toBe("claude-mem");
    expect(config.contextMode.enabled).toBe(true);
    expect(config.caveman.enabled).toBe(true);
    expect(config.ponytail.enabled).toBe(true);
    expect(config.review.openCodeReview.enabled).toBe(true);
    expect(config.von.enabled).toBe(true);
    expect(config.von.baseUrl).toBe("http://127.0.0.1:8000");
    expect(config.von.confidenceThreshold).toBe(0.75);
    expect(config.von.autoStart).toBe(true);
    expect(config.von.model).toBe("von-1.1");
    expect(config.reticle.enabled).toBe(true);
    expect(config.nextSeo.enabled).toBe(true);
    expect(config.security.semgrep.enabled).toBe(true);
    expect(config.security.codeql.enabled).toBe(true);
    expect(config.security.defaultPolicy).toBe("light");
    expect(config.validation.maxBuildAttempts).toBe(3);
  });
});
