import { describe, expect, it } from "vitest";
import type { SystemConfig } from "../src/core/config.js";
import { getCavemanGuidance } from "../src/providers/caveman.js";
import { getDisciplineRules } from "../src/providers/ponytail.js";

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

describe("discipline rules", () => {
  it("returns non-empty ponytail ladder with safety carve-outs", () => {
    const rules = getDisciplineRules(base());

    expect(rules.length).toBeGreaterThan(100);
    expect(rules.toLowerCase()).toContain("yagni");
    for (let i = 1; i <= 7; i += 1) {
      expect(rules).toMatch(new RegExp(`\\b${i}\\.`));
    }
    expect(rules.toLowerCase()).toContain("security");
    expect(rules.toLowerCase()).toContain("accessibility");
    expect(rules.toLowerCase()).toContain("validation");
    expect(rules.toLowerCase()).toContain("error handling");
  });

  it("mentions ponytail checkout path when present", () => {
    const rules = getDisciplineRules(base());
    if (rules.toLowerCase().includes("checkout")) {
      expect(rules).toContain("providers\\skills\\ponytail");
    }
  });
});

describe("compression guidance", () => {
  it("reports context-mode active when caveman disabled", () => {
    const guidance = getCavemanGuidance(base());
    expect(guidance.toLowerCase()).toContain("context-mode");
    expect(guidance.toLowerCase()).toMatch(/caveman.*off|off.*caveman/);
  });

  it("returns terse-output guidance when caveman is active", () => {
    const guidance = getCavemanGuidance(
      base({
        contextMode: { enabled: false },
        caveman: { enabled: true },
      }),
    );

    expect(guidance.toLowerCase()).toContain("caveman");
    expect(guidance.toLowerCase()).toMatch(/terse|brief|compress|filler/);
    expect(guidance.toLowerCase()).not.toContain("context-mode is active");
  });
});
