import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SystemConfig } from "../src/core/config.js";
import { reviewsDir } from "../src/core/paths.js";
import { registerProject } from "../src/project/register.js";
import { runOpenCodeReview } from "../src/providers/openCodeReview.js";
import { cliAvailable } from "../src/providers/which.js";

vi.mock("../src/providers/which.js", () => ({
  cliAvailable: vi.fn(() => true),
}));

vi.mock("node:child_process", () => ({
  execFileSync: vi.fn((command: string) => {
    if (command === "ocr") return '{"summary":"looks good"}';
    throw new Error("not a git repository");
  }),
}));

const tempPaths: string[] = [];

function makeTemp(prefix: string): string {
  const path = mkdtempSync(join(tmpdir(), prefix));
  tempPaths.push(path);
  return path;
}

function makeConfig(systemRoot: string): SystemConfig {
  return {
    systemRoot,
    projectRoots: [],
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
  };
}

afterEach(() => {
  vi.clearAllMocks();
  vi.mocked(cliAvailable).mockReturnValue(true);
  while (tempPaths.length > 0) {
    rmSync(tempPaths.pop()!, { recursive: true, force: true });
  }
});

describe("OpenCodeReview output paths", () => {
  it("registers review and temp directories", () => {
    const systemRoot = makeTemp("acs-review-system-");
    const workspacePath = makeTemp("acs-review-workspace-");
    cpSync(join(process.cwd(), "templates"), join(systemRoot, "templates"), {
      recursive: true,
    });

    const registered = registerProject(makeConfig(systemRoot), {
      workspacePath,
    });

    expect(existsSync(join(registered.brainPath, "reviews"))).toBe(true);
    expect(existsSync(join(registered.brainPath, "temp"))).toBe(true);
  });

  it.each([
    ["diff", "review"],
    ["scan", "scan"],
  ] as const)("writes %s JSON beneath reviewsDir", (mode, command) => {
    const systemRoot = makeTemp("acs-review-output-");
    const workspacePath = makeTemp("acs-review-target-");
    const config = makeConfig(systemRoot);
    const projectId = "project-123";

    const result = runOpenCodeReview(config, {
      workspacePath,
      projectId,
      mode,
    });

    expect(execFileSync).toHaveBeenCalledWith(
      "ocr",
      [command, "--format", "json"],
      expect.objectContaining({ cwd: workspacePath }),
    );
    expect(result).toContain(reviewsDir(config, projectId));

    const outputPath = result.slice(
      "Review saved: ".length,
      result.indexOf("\n\n"),
    );
    expect(outputPath.startsWith(reviewsDir(config, projectId))).toBe(true);
    expect(readFileSync(outputPath, "utf8")).toBe(
      '{"summary":"looks good"}',
    );
  });

  it("returns an install hint when ocr is unavailable", () => {
    vi.mocked(cliAvailable).mockReturnValue(false);

    const result = runOpenCodeReview(makeConfig(makeTemp("acs-review-missing-")), {
      workspacePath: makeTemp("acs-review-unused-"),
      projectId: "project-123",
      mode: "diff",
    });

    expect(result).toContain(
      "npm install -g @alibaba-group/open-code-review",
    );
    expect(execFileSync).not.toHaveBeenCalled();
  });
});
