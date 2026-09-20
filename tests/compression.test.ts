import { describe, it, expect } from "vitest";
import {
  activeCompressionProvider,
  assertCompressionPolicy,
} from "../src/providers/compression.js";
import type { SystemConfig } from "../src/core/config.js";

function base(partial: Partial<SystemConfig> = {}): SystemConfig {
  return {
    systemRoot: "C:\\AI-Coding-System",
    projectRoots: ["D:\\"],
    identity: { hashLength: 20 },
    graphify: { enabled: true, preferCodeOnly: true },
    memory: { enabled: true, provider: "claude-mem" },
    ponytail: { enabled: true },
    caveman: { enabled: false },
    contextMode: { enabled: true },
    review: { openCodeReview: { enabled: true } },
    security: {
      semgrep: { enabled: true },
      codeql: { enabled: false },
      bearer: { enabled: false },
      defaultPolicy: "light",
    },
    validation: { maxBuildAttempts: 3 },
    telemetry: { enabled: false },
    ...partial,
  };
}

describe("compression policy", () => {
  it("prefers context-mode when enabled and caveman off", () => {
    expect(activeCompressionProvider(base())).toBe("context-mode");
    expect(assertCompressionPolicy(base()).ok).toBe(true);
  });

  it("uses caveman when contextMode off and caveman on", () => {
    const c = base({
      contextMode: { enabled: false },
      caveman: { enabled: true },
    });
    expect(activeCompressionProvider(c)).toBe("caveman");
  });

  it("warns when both enabled (overlap)", () => {
    const c = base({
      contextMode: { enabled: true },
      caveman: { enabled: true },
    });
    const result = assertCompressionPolicy(c);
    expect(result.ok).toBe(false);
    expect(result.detail.toLowerCase()).toContain("overlap");
    // Active path still prefers context-mode to avoid double compression
    expect(activeCompressionProvider(c)).toBe("context-mode");
  });
});
