import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SystemConfig } from "../src/core/config.js";

const mocks = vi.hoisted(() => ({
  existsSync: vi.fn(),
  rmSync: vi.fn(),
  getGitSummary: vi.fn(),
  formatGitSummary: vi.fn(),
  resolveProjectId: vi.fn(),
  updateHandoff: vi.fn(),
  runOpenCodeReview: vi.fn(),
  runQualityCheck: vi.fn(),
  runSecurityScan: vi.fn(),
  runBuildValidation: vi.fn(),
}));

vi.mock("node:fs", () => ({
  existsSync: mocks.existsSync,
  rmSync: mocks.rmSync,
}));
vi.mock("../src/git/summary.js", () => ({
  getGitSummary: mocks.getGitSummary,
  formatGitSummary: mocks.formatGitSummary,
}));
vi.mock("../src/project/register.js", () => ({
  resolveProjectId: mocks.resolveProjectId,
}));
vi.mock("../src/project/state.js", () => ({
  updateHandoff: mocks.updateHandoff,
}));
vi.mock("../src/providers/openCodeReview.js", () => ({
  runOpenCodeReview: mocks.runOpenCodeReview,
}));
vi.mock("../src/providers/quality.js", () => ({
  runQualityCheck: mocks.runQualityCheck,
}));
vi.mock("../src/security/scan.js", () => ({
  runSecurityScan: mocks.runSecurityScan,
}));
vi.mock("../src/validation/build.js", () => ({
  runBuildValidation: mocks.runBuildValidation,
}));

import { finalizeTask } from "../src/orchestrator/finalizeTask.js";

function config(reviewEnabled = true): SystemConfig {
  return {
    systemRoot: "C:\\AI-Coding-System",
    projectRoots: ["D:\\"],
    identity: { hashLength: 20 },
    graphify: { enabled: true, preferCodeOnly: true },
    memory: { enabled: true, provider: "claude-mem" },
    ponytail: { enabled: true },
    caveman: { enabled: false },
    contextMode: { enabled: true },
    review: { openCodeReview: { enabled: reviewEnabled } },
    security: {
      semgrep: { enabled: true },
      codeql: { enabled: false },
      bearer: { enabled: false },
      defaultPolicy: "light",
    },
    validation: { maxBuildAttempts: 3 },
    telemetry: { enabled: false },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.existsSync.mockReturnValue(true);
  mocks.getGitSummary.mockReturnValue({ available: true });
  mocks.formatGitSummary.mockReturnValue("Branch: main");
  mocks.resolveProjectId.mockReturnValue("project-123");
  mocks.runBuildValidation.mockReturnValue("Build: passed (attempt 1/3).");
  mocks.runQualityCheck.mockReturnValue("Quality passed");
  mocks.runSecurityScan.mockReturnValue("Security passed");
  mocks.runOpenCodeReview.mockReturnValue("Review passed");
});

describe("finalizeTask", () => {
  it("runs requested checks in order, updates handoff, and cleans managed temp", () => {
    const result = finalizeTask(config(), {
      workspacePath: "D:\\app",
      sessionId: "session-1",
      qualityCheck: true,
      securityScan: true,
      review: true,
      completed: ["Task 13"],
    });

    const calls = [
      mocks.getGitSummary,
      mocks.runBuildValidation,
      mocks.runQualityCheck,
      mocks.runSecurityScan,
      mocks.runOpenCodeReview,
      mocks.updateHandoff,
      mocks.rmSync,
    ];
    for (let index = 1; index < calls.length; index += 1) {
      expect(calls[index - 1].mock.invocationCallOrder[0]).toBeLessThan(
        calls[index].mock.invocationCallOrder[0],
      );
    }
    expect(mocks.rmSync).toHaveBeenCalledWith(
      expect.stringMatching(
        /projects[\\/]project-123[\\/]temp[\\/]session-1$/,
      ),
      { recursive: true, force: true },
    );
    expect(result).toContain("- [x] Build");
    expect(result).toContain("- [x] Session cleanup");
  });

  it("skips optional checks and refuses traversal cleanup", () => {
    const result = finalizeTask(config(false), {
      workspacePath: "D:\\app",
      sessionId: "..\\outside",
      review: true,
    });

    expect(mocks.runQualityCheck).not.toHaveBeenCalled();
    expect(mocks.runSecurityScan).not.toHaveBeenCalled();
    expect(mocks.runOpenCodeReview).not.toHaveBeenCalled();
    expect(mocks.rmSync).not.toHaveBeenCalled();
    expect(result).toContain("disabled in configuration");
    expect(result).toContain("Refused:");
  });
});
