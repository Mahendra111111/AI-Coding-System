# T13
BASE: 464c92c8ba2a811ecfe04acc2a51dba75ac0bc2c
HEAD: 8a7e3ff3c8ed72d957ca462a53f58117afd7b4fe
## Commits
8a7e3ff feat: finalize_task end-of-task workflow
## Stat
 .superpowers/sdd/task-13-report.md |  27 ++++++
 src/mcp/tools.ts                   |  26 ++++++
 src/orchestrator/finalizeTask.ts   | 179 +++++++++++++++++++++++++++++++++++++
 src/validation/build.ts            |  84 +++++++++++++++++
 tests/finalize-task.test.ts        | 129 ++++++++++++++++++++++++++
 5 files changed, 445 insertions(+)
## Diff
diff --git a/.superpowers/sdd/task-13-report.md b/.superpowers/sdd/task-13-report.md
new file mode 100644
index 0000000..c6899a7
--- /dev/null
+++ b/.superpowers/sdd/task-13-report.md
@@ -0,0 +1,27 @@
+# Task 13 Report: finalize_task workflow
+
+## Status
+
+DONE
+
+## Implementation
+
+- Added package build-script detection and bounded build validation using `validation.maxBuildAttempts`.
+- Build failures return only extracted error lines; projects without a build script are skipped.
+- Added `finalizeTask(config, args)` with ordered git, build, optional quality, optional security, optional review, handoff, and cleanup checklist entries.
+- Review execution respects `review.openCodeReview.enabled`.
+- Session cleanup accepts a constrained session identifier and removes only the resolved managed `projects/<id>/temp/<session>` directory.
+- Registered the `finalize_task` MCP tool with optional checks disabled by default.
+- Added workflow-order, optional-check, handoff, managed-cleanup, and traversal-refusal tests.
+
+## Validation
+
+- Targeted test: 1 file passed, 2 tests passed.
+- Full suite: 14 files passed, 51 tests passed.
+- TypeScript build: passed.
+- `git diff --check`: passed.
+- IDE diagnostics only reported the two pre-existing stale module-resolution errors for `caveman.js` and `ponytail.js`; `tsc` passed.
+
+## Commit
+
+- `feat: finalize_task end-of-task workflow`
diff --git a/src/mcp/tools.ts b/src/mcp/tools.ts
index 47c178b..4dd159f 100644
--- a/src/mcp/tools.ts
+++ b/src/mcp/tools.ts
@@ -10,6 +10,7 @@ import {
   isGraphifyAvailable,
 } from "../graph/graphify.js";
 import { formatGitSummary, getGitSummary } from "../git/summary.js";
+import { finalizeTask } from "../orchestrator/finalizeTask.js";
 import { prepareContext } from "../orchestrator/prepareContext.js";
 import {
   listProjects,
@@ -374,6 +375,31 @@ export function createServer(): McpServer {
       textResult(runSecurityScan(config, { workspacePath, policy })),
   );
 
+  server.tool(
+    "finalize_task",
+    "Run the end-of-task checklist: git summary, build validation, requested quality/security/review checks, handoff update, and managed session-temp cleanup.",
+    {
+      workspacePath: z.string().describe("Absolute workspace path"),
+      projectId: z.string().optional(),
+      sessionId: z
+        .string()
+        .optional()
+        .describe("Managed session identifier to clean after finalization"),
+      qualityCheck: z.boolean().optional().default(false),
+      securityScan: z.boolean().optional().default(false),
+      securityPolicy: z.enum(["light", "normal", "deep"]).optional(),
+      review: z.boolean().optional().default(false),
+      currentTask: z.string().optional(),
+      completed: z.array(z.string()).optional(),
+      filesChanged: z.array(z.string()).optional(),
+      decision: z.string().optional(),
+      validation: z.string().optional(),
+      remaining: z.string().optional(),
+      editor: z.string().optional(),
+    },
+    async (args) => textResult(finalizeTask(config, args)),
+  );
+
   if (config.graphify.enabled) {
     server.tool(
       "graph_query",
diff --git a/src/orchestrator/finalizeTask.ts b/src/orchestrator/finalizeTask.ts
new file mode 100644
index 0000000..1e07e2e
--- /dev/null
+++ b/src/orchestrator/finalizeTask.ts
@@ -0,0 +1,179 @@
+import { existsSync, rmSync } from "node:fs";
+import { isAbsolute, relative, resolve } from "node:path";
+import type { SystemConfig, SecurityPolicy } from "../core/config.js";
+import { projectDir, projectsDir, tempSessionDir } from "../core/paths.js";
+import { formatGitSummary, getGitSummary } from "../git/summary.js";
+import { resolveProjectId } from "../project/register.js";
+import { updateHandoff, type HandoffUpdate } from "../project/state.js";
+import { runOpenCodeReview } from "../providers/openCodeReview.js";
+import { runQualityCheck } from "../providers/quality.js";
+import { runSecurityScan } from "../security/scan.js";
+import { runBuildValidation } from "../validation/build.js";
+
+export interface FinalizeTaskArgs extends HandoffUpdate {
+  workspacePath: string;
+  projectId?: string;
+  sessionId?: string;
+  qualityCheck?: boolean;
+  securityScan?: boolean;
+  securityPolicy?: SecurityPolicy;
+  review?: boolean;
+  handoff?: HandoffUpdate;
+}
+
+function checklistItem(
+  complete: boolean,
+  label: string,
+  detail: string,
+): string {
+  const indented = detail
+    .trim()
+    .split(/\r?\n/)
+    .map((line) => `   ${line}`)
+    .join("\n");
+  return `- [${complete ? "x" : " "}] ${label}\n${indented}`;
+}
+
+function requestedHandoff(args: FinalizeTaskArgs): HandoffUpdate | null {
+  const direct: HandoffUpdate = {
+    currentTask: args.currentTask,
+    completed: args.completed,
+    filesChanged: args.filesChanged,
+    decision: args.decision,
+    validation: args.validation,
+    remaining: args.remaining,
+    editor: args.editor,
+  };
+  const merged = { ...direct, ...args.handoff };
+  return Object.values(merged).some((value) => value !== undefined)
+    ? merged
+    : null;
+}
+
+function managedTempPath(
+  config: SystemConfig,
+  projectId: string,
+  sessionId: string,
+): string | null {
+  if (
+    !/^[A-Za-z0-9._-]+$/.test(sessionId) ||
+    sessionId === "." ||
+    sessionId === ".."
+  ) {
+    return null;
+  }
+
+  const projectsRoot = resolve(projectsDir(config));
+  const projectRoot = resolve(projectDir(config, projectId));
+  const tempPath = resolve(tempSessionDir(config, projectId, sessionId));
+  const projectRelative = relative(projectsRoot, projectRoot);
+  const tempRelative = relative(projectRoot, tempPath);
+  if (
+    !projectRelative ||
+    projectRelative.startsWith("..") ||
+    isAbsolute(projectRelative) ||
+    !tempRelative ||
+    tempRelative.startsWith("..") ||
+    isAbsolute(tempRelative)
+  ) {
+    return null;
+  }
+  return tempPath;
+}
+
+export function finalizeTask(
+  config: SystemConfig,
+  args: FinalizeTaskArgs,
+): string {
+  const report: string[] = ["# Finalize task"];
+  let resolvedProjectId: string | undefined;
+  const getProjectId = (): string => {
+    resolvedProjectId ??= resolveProjectId(config, {
+      workspacePath: args.workspacePath,
+      projectId: args.projectId,
+    });
+    return resolvedProjectId;
+  };
+
+  report.push(
+    checklistItem(
+      true,
+      "Git summary",
+      formatGitSummary(getGitSummary(args.workspacePath)),
+    ),
+  );
+
+  const build = runBuildValidation(config, args.workspacePath);
+  report.push(checklistItem(!build.startsWith("Build: failed"), "Build", build));
+
+  if (args.qualityCheck === true) {
+    report.push(
+      checklistItem(true, "Quality check", runQualityCheck(args.workspacePath)),
+    );
+  } else {
+    report.push(checklistItem(false, "Quality check", "Skipped: not requested."));
+  }
+
+  if (args.securityScan === true) {
+    report.push(
+      checklistItem(
+        true,
+        "Security scan",
+        runSecurityScan(config, {
+          workspacePath: args.workspacePath,
+          policy: args.securityPolicy,
+        }),
+      ),
+    );
+  } else {
+    report.push(checklistItem(false, "Security scan", "Skipped: not requested."));
+  }
+
+  if (args.review === true && config.review.openCodeReview.enabled) {
+    report.push(
+      checklistItem(
+        true,
+        "Review",
+        runOpenCodeReview(config, {
+          workspacePath: args.workspacePath,
+          projectId: getProjectId(),
+          mode: "diff",
+        }),
+      ),
+    );
+  } else {
+    const reason =
+      args.review === true ? "disabled in configuration" : "not requested";
+    report.push(checklistItem(false, "Review", `Skipped: ${reason}.`));
+  }
+
+  const handoff = requestedHandoff(args);
+  if (handoff) {
+    updateHandoff(config, getProjectId(), handoff);
+    report.push(checklistItem(true, "Handoff", "Updated provided fields."));
+  } else {
+    report.push(checklistItem(false, "Handoff", "Skipped: no fields provided."));
+  }
+
+  if (args.sessionId !== undefined) {
+    const path = managedTempPath(config, getProjectId(), args.sessionId);
+    if (!path) {
+      report.push(
+        checklistItem(
+          false,
+          "Session cleanup",
+          "Refused: session path is outside the managed project temp tree.",
+        ),
+      );
+    } else {
+      if (existsSync(path)) rmSync(path, { recursive: true, force: true });
+      report.push(checklistItem(true, "Session cleanup", `Cleaned: ${path}`));
+    }
+  } else {
+    report.push(
+      checklistItem(false, "Session cleanup", "Skipped: no sessionId provided."),
+    );
+  }
+
+  return report.join("\n\n");
+}
diff --git a/src/validation/build.ts b/src/validation/build.ts
new file mode 100644
index 0000000..64f7f4c
--- /dev/null
+++ b/src/validation/build.ts
@@ -0,0 +1,84 @@
+import { execFileSync } from "node:child_process";
+import { existsSync, readFileSync } from "node:fs";
+import { join } from "node:path";
+import type { SystemConfig } from "../core/config.js";
+
+interface CommandError {
+  stdout?: string;
+  stderr?: string;
+  message?: string;
+}
+
+interface PackageJson {
+  scripts?: Record<string, unknown>;
+}
+
+function hasBuildScript(workspacePath: string): boolean {
+  const packagePath = join(workspacePath, "package.json");
+  if (!existsSync(packagePath)) return false;
+
+  try {
+    const pkg = JSON.parse(readFileSync(packagePath, "utf8")) as PackageJson;
+    return typeof pkg.scripts?.build === "string" && pkg.scripts.build.trim() !== "";
+  } catch {
+    return false;
+  }
+}
+
+function errorLines(output: string): string[] {
+  return [
+    ...new Set(
+      output
+        .split(/\r?\n/)
+        .map((line) => line.trim())
+        .filter(Boolean)
+        .filter((line) =>
+          /(?:\berror\b|\bfailed\b|\bfailure\b|npm ERR!|TS\d{4})/i.test(line),
+        ),
+    ),
+  ];
+}
+
+export function runBuildValidation(
+  config: SystemConfig,
+  workspacePath: string,
+): string {
+  if (!hasBuildScript(workspacePath)) {
+    return "Build: skipped (no package.json scripts.build).";
+  }
+
+  const maxAttempts = Math.max(
+    1,
+    Math.floor(config.validation.maxBuildAttempts),
+  );
+  let lastErrors: string[] = [];
+
+  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
+    try {
+      execFileSync(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "build"], {
+        cwd: workspacePath,
+        encoding: "utf8",
+        stdio: ["ignore", "pipe", "pipe"],
+        windowsHide: true,
+        timeout: 300_000,
+      });
+      return `Build: passed (attempt ${attempt}/${maxAttempts}).`;
+    } catch (error) {
+      const commandError = error as CommandError;
+      const output = [commandError.stdout, commandError.stderr]
+        .filter((value): value is string => typeof value === "string")
+        .join("\n");
+      lastErrors = errorLines(output);
+      if (lastErrors.length === 0) {
+        lastErrors = errorLines(commandError.message ?? "");
+      }
+    }
+  }
+
+  return [
+    `Build: failed after ${maxAttempts} attempt${maxAttempts === 1 ? "" : "s"}.`,
+    ...(lastErrors.length > 0 ? lastErrors : ["Build command failed (no error lines returned)."]),
+  ].join("\n");
+}
+
+export const runBuild = runBuildValidation;
diff --git a/tests/finalize-task.test.ts b/tests/finalize-task.test.ts
new file mode 100644
index 0000000..715022b
--- /dev/null
+++ b/tests/finalize-task.test.ts
@@ -0,0 +1,129 @@
+import { beforeEach, describe, expect, it, vi } from "vitest";
+import type { SystemConfig } from "../src/core/config.js";
+
+const mocks = vi.hoisted(() => ({
+  existsSync: vi.fn(),
+  rmSync: vi.fn(),
+  getGitSummary: vi.fn(),
+  formatGitSummary: vi.fn(),
+  resolveProjectId: vi.fn(),
+  updateHandoff: vi.fn(),
+  runOpenCodeReview: vi.fn(),
+  runQualityCheck: vi.fn(),
+  runSecurityScan: vi.fn(),
+  runBuildValidation: vi.fn(),
+}));
+
+vi.mock("node:fs", () => ({
+  existsSync: mocks.existsSync,
+  rmSync: mocks.rmSync,
+}));
+vi.mock("../src/git/summary.js", () => ({
+  getGitSummary: mocks.getGitSummary,
+  formatGitSummary: mocks.formatGitSummary,
+}));
+vi.mock("../src/project/register.js", () => ({
+  resolveProjectId: mocks.resolveProjectId,
+}));
+vi.mock("../src/project/state.js", () => ({
+  updateHandoff: mocks.updateHandoff,
+}));
+vi.mock("../src/providers/openCodeReview.js", () => ({
+  runOpenCodeReview: mocks.runOpenCodeReview,
+}));
+vi.mock("../src/providers/quality.js", () => ({
+  runQualityCheck: mocks.runQualityCheck,
+}));
+vi.mock("../src/security/scan.js", () => ({
+  runSecurityScan: mocks.runSecurityScan,
+}));
+vi.mock("../src/validation/build.js", () => ({
+  runBuildValidation: mocks.runBuildValidation,
+}));
+
+import { finalizeTask } from "../src/orchestrator/finalizeTask.js";
+
+function config(reviewEnabled = true): SystemConfig {
+  return {
+    systemRoot: "C:\\AI-Coding-System",
+    projectRoots: ["D:\\"],
+    identity: { hashLength: 20 },
+    graphify: { enabled: true, preferCodeOnly: true },
+    memory: { enabled: true, provider: "claude-mem" },
+    ponytail: { enabled: true },
+    caveman: { enabled: false },
+    contextMode: { enabled: true },
+    review: { openCodeReview: { enabled: reviewEnabled } },
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
+beforeEach(() => {
+  vi.clearAllMocks();
+  mocks.existsSync.mockReturnValue(true);
+  mocks.getGitSummary.mockReturnValue({ available: true });
+  mocks.formatGitSummary.mockReturnValue("Branch: main");
+  mocks.resolveProjectId.mockReturnValue("project-123");
+  mocks.runBuildValidation.mockReturnValue("Build: passed (attempt 1/3).");
+  mocks.runQualityCheck.mockReturnValue("Quality passed");
+  mocks.runSecurityScan.mockReturnValue("Security passed");
+  mocks.runOpenCodeReview.mockReturnValue("Review passed");
+});
+
+describe("finalizeTask", () => {
+  it("runs requested checks in order, updates handoff, and cleans managed temp", () => {
+    const result = finalizeTask(config(), {
+      workspacePath: "D:\\app",
+      sessionId: "session-1",
+      qualityCheck: true,
+      securityScan: true,
+      review: true,
+      completed: ["Task 13"],
+    });
+
+    const calls = [
+      mocks.getGitSummary,
+      mocks.runBuildValidation,
+      mocks.runQualityCheck,
+      mocks.runSecurityScan,
+      mocks.runOpenCodeReview,
+      mocks.updateHandoff,
+      mocks.rmSync,
+    ];
+    for (let index = 1; index < calls.length; index += 1) {
+      expect(calls[index - 1].mock.invocationCallOrder[0]).toBeLessThan(
+        calls[index].mock.invocationCallOrder[0],
+      );
+    }
+    expect(mocks.rmSync).toHaveBeenCalledWith(
+      expect.stringMatching(
+        /projects[\\/]project-123[\\/]temp[\\/]session-1$/,
+      ),
+      { recursive: true, force: true },
+    );
+    expect(result).toContain("- [x] Build");
+    expect(result).toContain("- [x] Session cleanup");
+  });
+
+  it("skips optional checks and refuses traversal cleanup", () => {
+    const result = finalizeTask(config(false), {
+      workspacePath: "D:\\app",
+      sessionId: "..\\outside",
+      review: true,
+    });
+
+    expect(mocks.runQualityCheck).not.toHaveBeenCalled();
+    expect(mocks.runSecurityScan).not.toHaveBeenCalled();
+    expect(mocks.runOpenCodeReview).not.toHaveBeenCalled();
+    expect(mocks.rmSync).not.toHaveBeenCalled();
+    expect(result).toContain("disabled in configuration");
+    expect(result).toContain("Refused:");
+  });
+});
