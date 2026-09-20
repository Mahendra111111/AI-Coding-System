# T9
BASE: b9c096e6e514a255557711533098f49f621fac9b
HEAD: 248916c73a65674a44df4f06976babb3c642d24e
## Commits
248916c feat: OpenCodeReview provider writing to projects/<id>/reviews
## Stat
 .superpowers/sdd/task-9-report.md |  15 +++++
 src/mcp/tools.ts                  |  39 ++++++++++++
 src/providers/openCodeReview.ts   |  84 +++++++++++++++++++++++++
 tests/review-paths.test.ts        | 129 ++++++++++++++++++++++++++++++++++++++
 4 files changed, 267 insertions(+)
## Diff
diff --git a/.superpowers/sdd/task-9-report.md b/.superpowers/sdd/task-9-report.md
new file mode 100644
index 0000000..30323b1
--- /dev/null
+++ b/.superpowers/sdd/task-9-report.md
@@ -0,0 +1,15 @@
+# Task 9 Report: OpenCodeReview Adapter
+
+## Implemented
+
+- Added `runOpenCodeReview` with exhaustive `diff` / `scan` command selection.
+- Added a missing-CLI install hint for `@alibaba-group/open-code-review`.
+- Persisted OCR JSON output beneath `projects/<id>/reviews/` and returned its path with a 4,000-character summary.
+- Added MCP tools `review_diff` and `review_scan`.
+- Confirmed project registration creates both `reviews/` and `temp/`.
+- Added adapter, output-path, command, missing-CLI, and registration tests.
+
+## Validation
+
+- `npm test`: 10 files, 37 tests passed.
+- `npm run build`: passed.
diff --git a/src/mcp/tools.ts b/src/mcp/tools.ts
index f4ce0bb..da34c14 100644
--- a/src/mcp/tools.ts
+++ b/src/mcp/tools.ts
@@ -20,8 +20,9 @@ import {
   updateHandoff,
   updateProjectState,
 } from "../project/state.js";
 import { getCavemanGuidance } from "../providers/caveman.js";
+import { runOpenCodeReview } from "../providers/openCodeReview.js";
 import { securityRefs } from "../providers/owasp.js";
 import { getDisciplineRules } from "../providers/ponytail.js";
 import {
   detectQualityStack,
@@ -259,8 +260,46 @@ export function createServer(): McpServer {
     },
     async ({ workspacePath }) => textResult(runQualityCheck(workspacePath)),
   );
 
+  server.tool(
+    "review_diff",
+    "Run OpenCodeReview against the current workspace diff and save JSON output in the project reviews directory.",
+    {
+      workspacePath: z.string().describe("Absolute workspace path"),
+      projectId: z.string().optional(),
+    },
+    async ({ workspacePath, projectId }) => {
+      const id = resolveProjectId(config, { workspacePath, projectId });
+      return textResult(
+        runOpenCodeReview(config, {
+          workspacePath,
+          projectId: id,
+          mode: "diff",
+        }),
+      );
+    },
+  );
+
+  server.tool(
+    "review_scan",
+    "Run an OpenCodeReview workspace scan and save JSON output in the project reviews directory.",
+    {
+      workspacePath: z.string().describe("Absolute workspace path"),
+      projectId: z.string().optional(),
+    },
+    async ({ workspacePath, projectId }) => {
+      const id = resolveProjectId(config, { workspacePath, projectId });
+      return textResult(
+        runOpenCodeReview(config, {
+          workspacePath,
+          projectId: id,
+          mode: "scan",
+        }),
+      );
+    },
+  );
+
   server.tool(
     "security_refs",
     "Return compact OWASP secure-coding excerpts for a topic (input-validation, auth, session, crypto, injection, access-control, config, general).",
     {
diff --git a/src/providers/openCodeReview.ts b/src/providers/openCodeReview.ts
new file mode 100644
index 0000000..50d07f5
--- /dev/null
+++ b/src/providers/openCodeReview.ts
@@ -0,0 +1,84 @@
+import { execFileSync } from "node:child_process";
+import { mkdirSync, writeFileSync } from "node:fs";
+import { join } from "node:path";
+import type { SystemConfig } from "../core/config.js";
+import { reviewsDir } from "../core/paths.js";
+import { cliAvailable } from "./which.js";
+
+const MAX_SUMMARY_CHARS = 4000;
+
+export type OpenCodeReviewMode = "diff" | "scan";
+
+export interface OpenCodeReviewOptions {
+  workspacePath: string;
+  projectId: string;
+  mode: OpenCodeReviewMode;
+}
+
+function commandForMode(mode: OpenCodeReviewMode): string {
+  switch (mode) {
+    case "diff":
+      return "review";
+    case "scan":
+      return "scan";
+    default: {
+      const _exhaustive: never = mode;
+      return _exhaustive;
+    }
+  }
+}
+
+function timestampForFilename(): string {
+  return new Date().toISOString().replace(/[:.]/g, "-");
+}
+
+function truncate(text: string): string {
+  if (text.length <= MAX_SUMMARY_CHARS) return text;
+  return `${text.slice(0, MAX_SUMMARY_CHARS - 1)}ÔÇª`;
+}
+
+export function runOpenCodeReview(
+  config: SystemConfig,
+  options: OpenCodeReviewOptions,
+): string {
+  if (!cliAvailable("ocr")) {
+    return "OpenCodeReview is not installed. Install: npm install -g @alibaba-group/open-code-review";
+  }
+
+  const command = commandForMode(options.mode);
+  const outputDir = reviewsDir(config, options.projectId);
+  mkdirSync(outputDir, { recursive: true });
+
+  let output: string;
+  try {
+    output = execFileSync("ocr", [command, "--format", "json"], {
+      cwd: options.workspacePath,
+      encoding: "utf8",
+      stdio: ["ignore", "pipe", "pipe"],
+      windowsHide: true,
+      timeout: 300_000,
+    }).trim();
+  } catch (error) {
+    const executionError = error as {
+      stdout?: string;
+      stderr?: string;
+      message?: string;
+    };
+    output = [
+      executionError.stdout?.trim(),
+      executionError.stderr?.trim(),
+      executionError.message,
+    ]
+      .filter(Boolean)
+      .join("\n");
+  }
+
+  const result = output || "{}";
+  const outputPath = join(
+    outputDir,
+    `open-code-review-${options.mode}-${timestampForFilename()}.json`,
+  );
+  writeFileSync(outputPath, result, "utf8");
+
+  return `Review saved: ${outputPath}\n\n${truncate(result)}`;
+}
diff --git a/tests/review-paths.test.ts b/tests/review-paths.test.ts
new file mode 100644
index 0000000..48aede4
--- /dev/null
+++ b/tests/review-paths.test.ts
@@ -0,0 +1,129 @@
+import { execFileSync } from "node:child_process";
+import {
+  cpSync,
+  existsSync,
+  mkdtempSync,
+  readFileSync,
+  rmSync,
+} from "node:fs";
+import { tmpdir } from "node:os";
+import { join } from "node:path";
+import { afterEach, describe, expect, it, vi } from "vitest";
+import type { SystemConfig } from "../src/core/config.js";
+import { reviewsDir } from "../src/core/paths.js";
+import { registerProject } from "../src/project/register.js";
+import { runOpenCodeReview } from "../src/providers/openCodeReview.js";
+import { cliAvailable } from "../src/providers/which.js";
+
+vi.mock("../src/providers/which.js", () => ({
+  cliAvailable: vi.fn(() => true),
+}));
+
+vi.mock("node:child_process", () => ({
+  execFileSync: vi.fn((command: string) => {
+    if (command === "ocr") return '{"summary":"looks good"}';
+    throw new Error("not a git repository");
+  }),
+}));
+
+const tempPaths: string[] = [];
+
+function makeTemp(prefix: string): string {
+  const path = mkdtempSync(join(tmpdir(), prefix));
+  tempPaths.push(path);
+  return path;
+}
+
+function makeConfig(systemRoot: string): SystemConfig {
+  return {
+    systemRoot,
+    projectRoots: [],
+    identity: { hashLength: 20 },
+    graphify: { enabled: true, preferCodeOnly: true },
+    memory: { enabled: true, provider: "claude-mem" },
+    ponytail: { enabled: true },
+    caveman: { enabled: false },
+    contextMode: { enabled: true },
+    review: { openCodeReview: { enabled: true } },
+    security: {
+      semgrep: { enabled: true },
+      codeql: { enabled: false },
+      bearer: { enabled: false },
+      defaultPolicy: "light",
+    },
+    validation: { maxBuildAttempts: 3 },
+    telemetry: { enabled: false },
+  };
+}
+
+afterEach(() => {
+  vi.clearAllMocks();
+  vi.mocked(cliAvailable).mockReturnValue(true);
+  while (tempPaths.length > 0) {
+    rmSync(tempPaths.pop()!, { recursive: true, force: true });
+  }
+});
+
+describe("OpenCodeReview output paths", () => {
+  it("registers review and temp directories", () => {
+    const systemRoot = makeTemp("acs-review-system-");
+    const workspacePath = makeTemp("acs-review-workspace-");
+    cpSync(join(process.cwd(), "templates"), join(systemRoot, "templates"), {
+      recursive: true,
+    });
+
+    const registered = registerProject(makeConfig(systemRoot), {
+      workspacePath,
+    });
+
+    expect(existsSync(join(registered.brainPath, "reviews"))).toBe(true);
+    expect(existsSync(join(registered.brainPath, "temp"))).toBe(true);
+  });
+
+  it.each([
+    ["diff", "review"],
+    ["scan", "scan"],
+  ] as const)("writes %s JSON beneath reviewsDir", (mode, command) => {
+    const systemRoot = makeTemp("acs-review-output-");
+    const workspacePath = makeTemp("acs-review-target-");
+    const config = makeConfig(systemRoot);
+    const projectId = "project-123";
+
+    const result = runOpenCodeReview(config, {
+      workspacePath,
+      projectId,
+      mode,
+    });
+
+    expect(execFileSync).toHaveBeenCalledWith(
+      "ocr",
+      [command, "--format", "json"],
+      expect.objectContaining({ cwd: workspacePath }),
+    );
+    expect(result).toContain(reviewsDir(config, projectId));
+
+    const outputPath = result.slice(
+      "Review saved: ".length,
+      result.indexOf("\n\n"),
+    );
+    expect(outputPath.startsWith(reviewsDir(config, projectId))).toBe(true);
+    expect(readFileSync(outputPath, "utf8")).toBe(
+      '{"summary":"looks good"}',
+    );
+  });
+
+  it("returns an install hint when ocr is unavailable", () => {
+    vi.mocked(cliAvailable).mockReturnValue(false);
+
+    const result = runOpenCodeReview(makeConfig(makeTemp("acs-review-missing-")), {
+      workspacePath: makeTemp("acs-review-unused-"),
+      projectId: "project-123",
+      mode: "diff",
+    });
+
+    expect(result).toContain(
+      "npm install -g @alibaba-group/open-code-review",
+    );
+    expect(execFileSync).not.toHaveBeenCalled();
+  });
+});
