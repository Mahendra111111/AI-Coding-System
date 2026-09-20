# T12
BASE: 684afceda84c4b3ef028d9d2c24004146f757e1a
HEAD: 464c92c8ba2a811ecfe04acc2a51dba75ac0bc2c
## Commits
464c92c feat: prepare_context orchestrator
## Stat
 .superpowers/sdd/task-12-report.md |  26 ++++++
 src/mcp/tools.ts                   |  21 +++++
 src/orchestrator/prepareContext.ts | 176 +++++++++++++++++++++++++++++++++++++
 tests/prepare-context.test.ts      | 165 ++++++++++++++++++++++++++++++++++
 4 files changed, 388 insertions(+)
## Diff
diff --git a/.superpowers/sdd/task-12-report.md b/.superpowers/sdd/task-12-report.md
new file mode 100644
index 0000000..625375d
--- /dev/null
+++ b/.superpowers/sdd/task-12-report.md
@@ -0,0 +1,26 @@
+# Task 12 Report: prepare_context orchestrator
+
+## Status
+
+DONE
+
+## Implementation
+
+- Added `prepareContext(config, args)` with priority-ordered tagged sections and an 8,000-character hard cap.
+- Reused registered project context and Git summary data without reading or dumping repository contents.
+- Added compact, task-relevant OWASP excerpts capped at 650 characters.
+- Added opt-in Graphify queries gated by configuration and CLI availability.
+- Added opt-in Claude-Mem searches gated by configuration, limited to five compact task-text results.
+- Registered the `prepare_context` MCP tool with memory and graph flags disabled by default.
+- Added tests for section order, provider gating, selective retrieval, and output caps.
+
+## Validation
+
+- Targeted test: 1 file passed, 3 tests passed.
+- Full suite: 13 files passed, 49 tests passed.
+- TypeScript build: passed.
+- IDE diagnostics only reported the two pre-existing stale module-resolution errors for `caveman.js` and `ponytail.js`; `tsc` passed.
+
+## Commit
+
+- `feat: prepare_context orchestrator`
diff --git a/src/mcp/tools.ts b/src/mcp/tools.ts
index cece9e4..47c178b 100644
--- a/src/mcp/tools.ts
+++ b/src/mcp/tools.ts
@@ -9,8 +9,9 @@ import {
   graphQuery,
   isGraphifyAvailable,
 } from "../graph/graphify.js";
 import { formatGitSummary, getGitSummary } from "../git/summary.js";
+import { prepareContext } from "../orchestrator/prepareContext.js";
 import {
   listProjects,
   registerProject,
   resolveProjectId,
@@ -104,8 +105,28 @@ export function createServer(): McpServer {
       return textResult(built.context);
     },
   );
 
+  server.tool(
+    "prepare_context",
+    "Assemble task-scoped context in priority order. Optionally includes selective memory and Graphify relationships; never dumps repositories, full memory, or full OWASP references.",
+    {
+      workspacePath: z.string().describe("Absolute workspace path"),
+      task: z.string().min(1).describe("Current task and acceptance criteria"),
+      includeMemory: z.boolean().optional().default(false),
+      includeGraph: z.boolean().optional().default(false),
+    },
+    async ({ workspacePath, task, includeMemory, includeGraph }) =>
+      textResult(
+        await prepareContext(config, {
+          workspacePath,
+          task,
+          includeMemory: includeMemory ?? false,
+          includeGraph: includeGraph ?? false,
+        }),
+      ),
+  );
+
   server.tool(
     "get_handoff",
     "Return only the latest HANDOFF.md for fast continuation when switching editors.",
     {
diff --git a/src/orchestrator/prepareContext.ts b/src/orchestrator/prepareContext.ts
new file mode 100644
index 0000000..f3a5266
--- /dev/null
+++ b/src/orchestrator/prepareContext.ts
@@ -0,0 +1,176 @@
+import type { SystemConfig } from "../core/config.js";
+import { buildProjectContext } from "../context/buildContext.js";
+import { getGitSummary } from "../git/summary.js";
+import {
+  graphQuery,
+  isGraphifyAvailable,
+} from "../graph/graphify.js";
+import { registerProject } from "../project/register.js";
+import { memorySearch } from "../providers/claudeMem.js";
+import { securityRefs, type SecurityTopic } from "../providers/owasp.js";
+
+const MAX_CONTEXT_CHARS = 8_000;
+
+export interface PrepareContextArgs {
+  workspacePath: string;
+  task: string;
+  includeMemory?: boolean;
+  includeGraph?: boolean;
+}
+
+interface ContextSection {
+  tag: string;
+  body: string;
+  maxChars: number;
+}
+
+function truncate(text: string, maxChars: number): string {
+  const compact = text.trim();
+  if (!compact) return "(none)";
+  if (compact.length <= maxChars) return compact;
+  return `${compact.slice(0, Math.max(0, maxChars - 14)).trimEnd()}\nÔÇª(truncated)`;
+}
+
+function extractTaggedSection(context: string, tag: string): string {
+  const marker = `[${tag}]`;
+  const start = context.indexOf(marker);
+  if (start < 0) return "";
+  const bodyStart = start + marker.length;
+  const next = context.indexOf("\n[", bodyStart);
+  return context.slice(bodyStart, next < 0 ? undefined : next).trim();
+}
+
+function extractAcceptanceCriteria(task: string): string {
+  const heading = /(?:^|\n)\s*(?:#{1,6}\s*)?(?:acceptance criteria|criteria|requirements)\s*:?\s*\n/i;
+  const match = heading.exec(task);
+  if (match?.index !== undefined) {
+    const after = task.slice(match.index + match[0].length);
+    const nextHeading = after.search(/\n\s*#{1,6}\s+\S/);
+    const criteria = after.slice(0, nextHeading < 0 ? undefined : nextHeading).trim();
+    if (criteria) return criteria;
+  }
+
+  const checklist = task
+    .split(/\r?\n/)
+    .filter((line) => /^\s*(?:[-*]\s+\[[ xX]\]|(?:must|should)\b)/i.test(line))
+    .join("\n");
+  return checklist || "(not separately provided)";
+}
+
+function relevantErrors(projectContext: string): string {
+  const candidates = [
+    extractTaggedSection(projectContext, "VALIDATION"),
+    extractTaggedSection(projectContext, "KNOWN_ISSUES"),
+  ].filter(
+    (value) =>
+      value &&
+      !/^(?:\(not run\)|\(none\)|none\.?|not run\.?)$/i.test(value.trim()),
+  );
+  return candidates.join("\n\n") || "(none recorded)";
+}
+
+function securityTopic(task: string): SecurityTopic | null {
+  const lower = task.toLowerCase();
+  if (/\b(auth|login|password|credential|identity)\b/.test(lower)) return "auth";
+  if (/\b(session|cookie|jwt|token|logout)\b/.test(lower)) return "session";
+  if (/\b(sql|xss|injection|command execution)\b/.test(lower)) return "injection";
+  if (/\b(permission|authorization|access control|rbac|privilege)\b/.test(lower)) {
+    return "access-control";
+  }
+  if (/\b(encrypt|decrypt|crypto|hash|cipher|tls|certificate)\b/.test(lower)) {
+    return "crypto";
+  }
+  if (/\b(validate|validation|sanitize|user input)\b/.test(lower)) {
+    return "input-validation";
+  }
+  if (/\b(config|configuration|secret|environment variable)\b/.test(lower)) {
+    return "config";
+  }
+  if (/\b(security|secure|vulnerability|owasp)\b/.test(lower)) return "general";
+  return null;
+}
+
+function formatModifiedFiles(workspacePath: string): string {
+  const git = getGitSummary(workspacePath);
+  if (!git.available) return `Git unavailable: ${git.error ?? "unknown error"}`;
+  const files = [...new Set([...git.stagedFiles, ...git.dirtyFiles])];
+  return files.length ? files.map((file) => `- ${file}`).join("\n") : "(none)";
+}
+
+function assemble(sections: ContextSection[]): string {
+  const parts: string[] = [];
+  for (const section of sections) {
+    parts.push(`[${section.tag}]\n${truncate(section.body, section.maxChars)}`);
+  }
+  const context = parts.join("\n\n");
+  return context.length <= MAX_CONTEXT_CHARS
+    ? context
+    : `${context.slice(0, MAX_CONTEXT_CHARS - 14).trimEnd()}\nÔÇª(truncated)`;
+}
+
+export async function prepareContext(
+  config: SystemConfig,
+  args: PrepareContextArgs,
+): Promise<string> {
+  registerProject(config, { workspacePath: args.workspacePath });
+  const projectContext = buildProjectContext(config, {
+    workspacePath: args.workspacePath,
+    includeGit: false,
+  }).context;
+
+  const topic = securityTopic(args.task);
+  const security = topic
+    ? securityRefs(config, topic, 650)
+    : "(no task-specific security context identified)";
+
+  let graph = "(not requested or unavailable)";
+  if (
+    args.includeGraph === true &&
+    config.graphify.enabled &&
+    isGraphifyAvailable()
+  ) {
+    try {
+      graph = graphQuery(args.workspacePath, truncate(args.task, 500));
+    } catch (error) {
+      graph = `Graphify query failed: ${error instanceof Error ? error.message : String(error)}`;
+    }
+  }
+
+  let extra = "(none)";
+  if (args.includeMemory === true && config.memory.enabled) {
+    extra = await memorySearch(config, truncate(args.task, 500), 5);
+  }
+
+  return assemble([
+    { tag: "TASK", body: args.task, maxChars: 1_400 },
+    {
+      tag: "ACCEPTANCE_CRITERIA",
+      body: extractAcceptanceCriteria(args.task),
+      maxChars: 800,
+    },
+    {
+      tag: "MODIFIED_FILES",
+      body: formatModifiedFiles(args.workspacePath),
+      maxChars: 900,
+    },
+    { tag: "ERRORS", body: relevantErrors(projectContext), maxChars: 700 },
+    { tag: "SECURITY", body: security, maxChars: 650 },
+    {
+      tag: "ARCHITECTURE",
+      body: extractTaggedSection(projectContext, "ARCHITECTURE"),
+      maxChars: 800,
+    },
+    {
+      tag: "CONSTRAINTS",
+      body: extractTaggedSection(projectContext, "CONSTRAINTS"),
+      maxChars: 600,
+    },
+    {
+      tag: "DECISIONS",
+      body: extractTaggedSection(projectContext, "DECISIONS"),
+      maxChars: 600,
+    },
+    { tag: "GRAPHIFY", body: graph, maxChars: 550 },
+    { tag: "EXTRA", body: extra, maxChars: 450 },
+  ]);
+}
diff --git a/tests/prepare-context.test.ts b/tests/prepare-context.test.ts
new file mode 100644
index 0000000..c6e5572
--- /dev/null
+++ b/tests/prepare-context.test.ts
@@ -0,0 +1,165 @@
+import { beforeEach, describe, expect, it, vi } from "vitest";
+import type { SystemConfig } from "../src/core/config.js";
+
+const mocks = vi.hoisted(() => ({
+  buildProjectContext: vi.fn(),
+  getGitSummary: vi.fn(),
+  graphQuery: vi.fn(),
+  isGraphifyAvailable: vi.fn(),
+  memorySearch: vi.fn(),
+  registerProject: vi.fn(),
+  securityRefs: vi.fn(),
+}));
+
+vi.mock("../src/context/buildContext.js", () => ({
+  buildProjectContext: mocks.buildProjectContext,
+}));
+vi.mock("../src/git/summary.js", () => ({
+  getGitSummary: mocks.getGitSummary,
+}));
+vi.mock("../src/graph/graphify.js", () => ({
+  graphQuery: mocks.graphQuery,
+  isGraphifyAvailable: mocks.isGraphifyAvailable,
+}));
+vi.mock("../src/project/register.js", () => ({
+  registerProject: mocks.registerProject,
+}));
+vi.mock("../src/providers/claudeMem.js", () => ({
+  memorySearch: mocks.memorySearch,
+}));
+vi.mock("../src/providers/owasp.js", () => ({
+  securityRefs: mocks.securityRefs,
+}));
+
+import { prepareContext } from "../src/orchestrator/prepareContext.js";
+
+function config(memoryEnabled = true, graphEnabled = true): SystemConfig {
+  return {
+    systemRoot: "C:\\acs",
+    projectRoots: ["C:\\"],
+    identity: { hashLength: 20 },
+    graphify: { enabled: graphEnabled, preferCodeOnly: true },
+    memory: { enabled: memoryEnabled, provider: "claude-mem" },
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
+beforeEach(() => {
+  vi.clearAllMocks();
+  mocks.buildProjectContext.mockReturnValue({
+    projectId: "project",
+    meta: {},
+    context: [
+      "[ARCHITECTURE]",
+      "API and domain layers",
+      "[CONSTRAINTS]",
+      "Keep public API stable",
+      "[DECISIONS]",
+      "Use TypeScript",
+      "[VALIDATION]",
+      "Type error in src/auth.ts",
+      "[KNOWN_ISSUES]",
+      "(none)",
+    ].join("\n"),
+  });
+  mocks.getGitSummary.mockReturnValue({
+    available: true,
+    stagedFiles: ["src/auth.ts"],
+    dirtyFiles: ["src/auth.ts", "tests/auth.test.ts"],
+  });
+  mocks.isGraphifyAvailable.mockReturnValue(true);
+  mocks.graphQuery.mockReturnValue("AuthService -> SessionStore");
+  mocks.memorySearch.mockResolvedValue("Observation 7: prior auth migration");
+  mocks.securityRefs.mockReturnValue("Short OWASP auth excerpt");
+});
+
+describe("prepareContext", () => {
+  it("assembles tagged task context in priority order", async () => {
+    const result = await prepareContext(config(), {
+      workspacePath: "C:\\project",
+      task: "Implement auth\n\nAcceptance criteria:\n- [ ] Sessions expire",
+      includeMemory: true,
+      includeGraph: true,
+    });
+
+    const tags = [
+      "TASK",
+      "ACCEPTANCE_CRITERIA",
+      "MODIFIED_FILES",
+      "ERRORS",
+      "SECURITY",
+      "ARCHITECTURE",
+      "CONSTRAINTS",
+      "DECISIONS",
+      "GRAPHIFY",
+      "EXTRA",
+    ];
+    for (let index = 1; index < tags.length; index += 1) {
+      expect(result.indexOf(`[${tags[index - 1]}]`)).toBeLessThan(
+        result.indexOf(`[${tags[index]}]`),
+      );
+    }
+
+    expect(result).toContain("Sessions expire");
+    expect(result).toContain("tests/auth.test.ts");
+    expect(result).toContain("Type error in src/auth.ts");
+    expect(result).toContain("AuthService -> SessionStore");
+    expect(result).toContain("Observation 7");
+    expect(result.length).toBeLessThanOrEqual(8_000);
+    expect(mocks.graphQuery).toHaveBeenCalledOnce();
+    expect(mocks.memorySearch).toHaveBeenCalledWith(
+      expect.anything(),
+      expect.stringContaining("Implement auth"),
+      5,
+    );
+    expect(mocks.securityRefs).toHaveBeenCalledWith(
+      expect.anything(),
+      "auth",
+      650,
+    );
+  });
+
+  it("does not query optional providers without both opt-in and enablement", async () => {
+    mocks.isGraphifyAvailable.mockReturnValue(false);
+
+    const result = await prepareContext(config(false, true), {
+      workspacePath: "C:\\project",
+      task: "Refactor parser",
+      includeMemory: true,
+      includeGraph: true,
+    });
+
+    expect(mocks.memorySearch).not.toHaveBeenCalled();
+    expect(mocks.graphQuery).not.toHaveBeenCalled();
+    expect(mocks.securityRefs).not.toHaveBeenCalled();
+    expect(result).toContain("[EXTRA]\n(none)");
+    expect(result).toContain("[GRAPHIFY]\n(not requested or unavailable)");
+  });
+
+  it("caps oversized provider output", async () => {
+    mocks.graphQuery.mockReturnValue("g".repeat(20_000));
+    mocks.memorySearch.mockResolvedValue("m".repeat(20_000));
+
+    const result = await prepareContext(config(), {
+      workspacePath: "C:\\project",
+      task: `Secure auth flow ${"t".repeat(20_000)}`,
+      includeMemory: true,
+      includeGraph: true,
+    });
+
+    expect(result.length).toBeLessThanOrEqual(8_000);
+    expect(result).toContain("ÔÇª(truncated)");
+    expect(result).toContain("[EXTRA]");
+  });
+});
