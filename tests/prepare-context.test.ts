import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SystemConfig } from "../src/core/config.js";

const mocks = vi.hoisted(() => ({
  buildProjectContext: vi.fn(),
  getGitSummary: vi.fn(),
  graphQuery: vi.fn(),
  isGraphifyAvailable: vi.fn(),
  memorySearch: vi.fn(),
  registerProject: vi.fn(),
  securityRefs: vi.fn(),
}));

vi.mock("../src/context/buildContext.js", () => ({
  buildProjectContext: mocks.buildProjectContext,
}));
vi.mock("../src/git/summary.js", () => ({
  getGitSummary: mocks.getGitSummary,
}));
vi.mock("../src/graph/graphify.js", () => ({
  graphQuery: mocks.graphQuery,
  isGraphifyAvailable: mocks.isGraphifyAvailable,
}));
vi.mock("../src/project/register.js", () => ({
  registerProject: mocks.registerProject,
}));
vi.mock("../src/providers/claudeMem.js", () => ({
  memorySearch: mocks.memorySearch,
}));
vi.mock("../src/providers/owasp.js", () => ({
  securityRefs: mocks.securityRefs,
}));

import { prepareContext } from "../src/orchestrator/prepareContext.js";

function config(memoryEnabled = true, graphEnabled = true): SystemConfig {
  return {
    systemRoot: "C:\\acs",
    projectRoots: ["C:\\"],
    identity: { hashLength: 20 },
    graphify: { enabled: graphEnabled, preferCodeOnly: true },
    memory: { enabled: memoryEnabled, provider: "claude-mem" },
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
    von: {
      enabled: true,
      baseUrl: "http://127.0.0.1:8000",
      confidenceThreshold: 0.75,
      autoStart: false,
      model: "von-1.1",
    },
    reticle: { enabled: true },
    nextSeo: { enabled: true },
    telemetry: { enabled: false },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.buildProjectContext.mockReturnValue({
    projectId: "project",
    meta: {},
    context: [
      "[ARCHITECTURE]",
      "API and domain layers",
      "[CONSTRAINTS]",
      "Keep public API stable",
      "[DECISIONS]",
      "Use TypeScript",
      "[VALIDATION]",
      "Type error in src/auth.ts",
      "[KNOWN_ISSUES]",
      "(none)",
    ].join("\n"),
  });
  mocks.getGitSummary.mockReturnValue({
    available: true,
    stagedFiles: ["src/auth.ts"],
    dirtyFiles: ["src/auth.ts", "tests/auth.test.ts"],
  });
  mocks.isGraphifyAvailable.mockReturnValue(true);
  mocks.graphQuery.mockReturnValue("AuthService -> SessionStore");
  mocks.memorySearch.mockResolvedValue("Observation 7: prior auth migration");
  mocks.securityRefs.mockReturnValue("Short OWASP auth excerpt");
});

describe("prepareContext", () => {
  it("assembles tagged task context in priority order", async () => {
    const result = await prepareContext(config(), {
      workspacePath: "C:\\project",
      task: "Implement auth\n\nAcceptance criteria:\n- [ ] Sessions expire",
      includeMemory: true,
      includeGraph: true,
    });

    const tags = [
      "TASK",
      "ACCEPTANCE_CRITERIA",
      "MODIFIED_FILES",
      "ERRORS",
      "SECURITY",
      "ARCHITECTURE",
      "CONSTRAINTS",
      "DECISIONS",
      "GRAPHIFY",
      "EXTRA",
    ];
    for (let index = 1; index < tags.length; index += 1) {
      expect(result.indexOf(`[${tags[index - 1]}]`)).toBeLessThan(
        result.indexOf(`[${tags[index]}]`),
      );
    }

    expect(result).toContain("Sessions expire");
    expect(result).toContain("tests/auth.test.ts");
    expect(result).toContain("Type error in src/auth.ts");
    expect(result).toContain("AuthService -> SessionStore");
    expect(result).toContain("Observation 7");
    expect(result.length).toBeLessThanOrEqual(8_000);
    expect(mocks.graphQuery).toHaveBeenCalledOnce();
    expect(mocks.memorySearch).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining("Implement auth"),
      5,
    );
    expect(mocks.securityRefs).toHaveBeenCalledWith(
      expect.anything(),
      "auth",
      650,
    );
  });

  it("does not query optional providers without both opt-in and enablement", async () => {
    mocks.isGraphifyAvailable.mockReturnValue(false);

    const result = await prepareContext(config(false, true), {
      workspacePath: "C:\\project",
      task: "Refactor parser",
      includeMemory: true,
      includeGraph: true,
    });

    expect(mocks.memorySearch).not.toHaveBeenCalled();
    expect(mocks.graphQuery).not.toHaveBeenCalled();
    expect(mocks.securityRefs).not.toHaveBeenCalled();
    expect(result).toContain("[EXTRA]\n(none)");
    expect(result).toContain("[GRAPHIFY]\n(not requested or unavailable)");
  });

  it("caps oversized provider output", async () => {
    mocks.graphQuery.mockReturnValue("g".repeat(20_000));
    mocks.memorySearch.mockResolvedValue("m".repeat(20_000));

    const result = await prepareContext(config(), {
      workspacePath: "C:\\project",
      task: `Secure auth flow ${"t".repeat(20_000)}`,
      includeMemory: true,
      includeGraph: true,
    });

    expect(result.length).toBeLessThanOrEqual(8_000);
    expect(result).toContain("…(truncated)");
    expect(result).toContain("[EXTRA]");
  });
});
