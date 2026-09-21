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
      defaultPolicy: "light",
    },
    validation: { maxBuildAttempts: 3 },
    telemetry: { enabled: false },
    ...partial,
  };
}

describe("compression policy", () => {
  it("labels context-mode when enabled and caveman off", () => {
    expect(activeCompressionProvider(base())).toBe("context-mode");
    expect(assertCompressionPolicy(base())).toEqual({
      ok: true,
      detail: "tool-context: context-mode; output-compression: off",
    });
  });

  it("uses caveman for output-compression when enabled", () => {
    const c = base({
      contextMode: { enabled: false },
      caveman: { enabled: true },
    });
    expect(activeCompressionProvider(c)).toBe("caveman");
    expect(assertCompressionPolicy(c)).toEqual({
      ok: true,
      detail: "tool-context: off; output-compression: caveman",
    });
  });

  it("supports neither provider", () => {
    const c = base({
      contextMode: { enabled: false },
      caveman: { enabled: false },
    });
    expect(activeCompressionProvider(c)).toBe("none");
    expect(assertCompressionPolicy(c)).toEqual({
      ok: true,
      detail: "tool-context: off; output-compression: off",
    });
  });

  it("allows both enabled (separate roles; no overlap)", () => {
    const c = base({
      contextMode: { enabled: true },
      caveman: { enabled: true },
    });
    const result = assertCompressionPolicy(c);
    expect(result.ok).toBe(true);
    expect(result.detail).toBe(
      "tool-context: context-mode; output-compression: caveman",
    );
    expect(result.detail.toLowerCase()).not.toContain("overlap");
    expect(activeCompressionProvider(c)).toBe("caveman");
  });
});
