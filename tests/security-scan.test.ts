import { execFileSync } from "node:child_process";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SystemConfig } from "../src/core/config.js";
import { cliAvailable } from "../src/providers/which.js";
import { runSecurityScan } from "../src/security/scan.js";

vi.mock("../src/providers/which.js", () => ({
  cliAvailable: vi.fn(() => true),
}));

vi.mock("node:child_process", () => ({
  execFileSync: vi.fn((command: string) => {
    if (command === "semgrep") {
      return JSON.stringify({
        results: [
          {
            check_id: "test.rule",
            path: "src/app.ts",
            start: { line: 7 },
            extra: { message: "Unsafe input", severity: "ERROR" },
          },
        ],
      });
    }
    if (command === "bearer") return JSON.stringify({ findings: [] });
    if (command === "codeql") return "rule,path,line\n";
    return "";
  }),
}));

function config(
  security: Partial<SystemConfig["security"]> = {},
): SystemConfig {
  return {
    systemRoot: "C:\\AI-Coding-System",
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
      ...security,
    },
    validation: { maxBuildAttempts: 3 },
    telemetry: { enabled: false },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(cliAvailable).mockReturnValue(true);
});

describe("runSecurityScan", () => {
  it("runs Semgrep first for light policy and summarizes JSON", () => {
    const result = runSecurityScan(config(), {
      workspacePath: "C:\\workspace",
      policy: "light",
    });

    expect(execFileSync).toHaveBeenCalledWith(
      "semgrep",
      ["scan", "--config", "auto", "--json", "."],
      expect.objectContaining({ cwd: "C:\\workspace" }),
    );
    expect(result).toContain("test.rule");
    expect(result).toContain("src/app.ts:7");
    expect(result).not.toContain('"results"');
  });

  it("uses the configured default and adds review guidance for normal", () => {
    const result = runSecurityScan(config({ defaultPolicy: "normal" }), {
      workspacePath: "C:\\workspace",
    });

    expect(result).toContain("Security policy: normal");
    expect(result).toContain("review_diff or review_scan");
  });

  it("runs enabled and available deep scanners", () => {
    const result = runSecurityScan(
      config({
        codeql: { enabled: true },
        bearer: { enabled: true },
        defaultPolicy: "deep",
      }),
      { workspacePath: "C:\\workspace" },
    );

    expect(execFileSync).toHaveBeenCalledWith(
      "codeql",
      ["database", "analyze", ".", "--format=csv", "--output=-"],
      expect.any(Object),
    );
    expect(execFileSync).toHaveBeenCalledWith(
      "bearer",
      ["scan", ".", "--format", "json"],
      expect.any(Object),
    );
    expect(result).toContain("=== CodeQL ===");
    expect(result).toContain("=== Bearer ===");
  });

  it("reports skipped scanners when disabled or unavailable", () => {
    vi.mocked(cliAvailable).mockReturnValue(false);

    const result = runSecurityScan(
      config({
        codeql: { enabled: true },
        bearer: { enabled: false },
        defaultPolicy: "deep",
      }),
      { workspacePath: "C:\\workspace" },
    );

    expect(result).toContain("Skipped: CLI unavailable");
    expect(result).toContain("Skipped: disabled");
    expect(execFileSync).not.toHaveBeenCalled();
  });

  it("truncates all returned findings to 3000 characters", () => {
    vi.mocked(execFileSync).mockReturnValue("x".repeat(5000));

    const result = runSecurityScan(config(), {
      workspacePath: "C:\\workspace",
    });

    expect(result.length).toBeLessThanOrEqual(3000);
  });
});
