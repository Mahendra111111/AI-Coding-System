# Final fix review
BASE: 797dce3a74672329beb6683b3a371e5d0bcb8d41
HEAD: c28612cb58861e2f47e0b4de13970847bdb3c1be
## Commits
c28612c fix: address final review production blockers
## Stat
 .superpowers/sdd/task-final-fix-report.md          | 24 +++++++++++++++
 docs/PROVIDERS.md                                  |  4 +--
 .../specs/2026-09-20-provider-mcp-facade-design.md |  6 ++--
 src/mcp/tools.ts                                   | 23 ++++++++++++--
 src/orchestrator/finalizeTask.ts                   | 33 ++++++++++++--------
 src/providers/caveman.ts                           |  4 +--
 src/providers/openCodeReview.ts                    | 30 +++++++++++++++---
 src/providers/ponytail.ts                          |  4 +++
 src/providers/quality.ts                           |  2 +-
 src/security/scan.ts                               | 24 +++++++++++++--
 tests/compression.test.ts                          | 16 ++++++++++
 tests/discipline-rules.test.ts                     | 15 +++++++--
 tests/finalize-task.test.ts                        | 34 ++++++++++++++++++++
 tests/review-paths.test.ts                         | 36 ++++++++++++++++++++++
 tests/security-scan.test.ts                        | 36 +++++++++++++++++++++-
 15 files changed, 259 insertions(+), 32 deletions(-)
## Diff
diff --git a/.superpowers/sdd/task-final-fix-report.md b/.superpowers/sdd/task-final-fix-report.md
new file mode 100644
index 0000000..55b2f5f
--- /dev/null
+++ b/.superpowers/sdd/task-final-fix-report.md
@@ -0,0 +1,24 @@
+# Final Review Production Blockers ÔÇö Fix Report
+
+Date: 2026-09-20
+
+## Fixed
+
+- Context Mode is documented and reported as the preferred compression policy label, with explicit peer-MCP invocation required until ACS proxies it.
+- `finalize_task` leaves quality, security, and review items incomplete for skipped, unavailable, conflicted, failed, error, refusal, or install-hint output. Provider command failures now include explicit failure markers.
+- Deep CodeQL scans require an existing database from `CODEQL_DATABASE` or `<workspace>/codeql-db`; source trees are never passed as databases.
+- OpenCodeReview validates safe project IDs and verifies the resolved reviews directory remains beneath the managed projects root.
+- `provider_status` catches registry failures and returns a JSON error object.
+- Added `"none"` and caveman-only compression-policy assertions.
+- `discipline_rules` now honors `ponytail.enabled`.
+
+## Verification
+
+- Targeted regression tests: 28 passed.
+- Full suite: 14 files, 60 tests passed.
+- TypeScript build: passed.
+- `git diff --check`: passed.
+
+## Notes
+
+- Existing unrelated modified and untracked SDD artifacts were left untouched and excluded from the fix commit.
diff --git a/docs/PROVIDERS.md b/docs/PROVIDERS.md
index c9813fb..2196da4 100644
--- a/docs/PROVIDERS.md
+++ b/docs/PROVIDERS.md
@@ -16,19 +16,19 @@ are reported but do not fail the script, so it is safe to rerun.
 ## Provider catalog
 
 | Provider | Purpose | Installation and behavior |
 | --- | --- | --- |
 | Graphify | Code-structure indexing | Installs `graphifyy` with `uv tool`, then falls back to `pipx` or user-scoped `pip`. |
-| Context Mode | Tool-context control | Installs global npm package `context-mode` only when it exists in the npm registry. If unavailable, use Context Mode as a peer MCP server according to its upstream README; ACS does not currently proxy it. |
+| Context Mode | Tool-context control | `contextMode.enabled` selects the preferred compression policy label only; ACS does not invoke or proxy Context Mode yet. Configure and invoke it as a peer MCP server according to its upstream README until ACS proxy support exists. |
 | OpenCodeReview | Code review | Installs global npm package `@alibaba-group/open-code-review`; its expected CLI is `ocr`. |
 | Ponytail | Implementation discipline | Shallow-cloned to `providers/skills/ponytail`. An existing checkout is left unchanged. |
 | Caveman | Output compression | Shallow-cloned to `providers/skills/caveman`. It is installed but config-disabled by default because ACS compression modes are mutually exclusive. |
 | OWASP Secure Coding Practices | Security reference | Shallow-cloned to `providers/refs/owasp-scp`. |
 | OWASP Top 10 | Security reference | Shallow-cloned to `providers/refs/owasp-top10`. |
 | Claude-Mem | Historical memory | Not installed automatically. Run `npx claude-mem install --provider host` when ready; the installer does not force cloud sign-in. ACS defaults to `http://127.0.0.1:37777`, but current Claude-Mem releases assign a per-user port (`37700 + uid % 100`) and store it in `~/.claude-mem/settings.json`; set `CLAUDE_MEM_WORKER_URL` to the active base URL when it differs. |
 | Semgrep | Fast security scanning | Installed with user-scoped `pip` unless already available or `-SkipHeavy` is set. Failure is non-fatal. |
-| CodeQL | Deep security analysis | Detection only. Install the [CodeQL CLI](https://docs.github.com/en/code-security/codeql-cli) manually when needed. |
+| CodeQL | Deep security analysis | Detection only. Install the [CodeQL CLI](https://docs.github.com/en/code-security/codeql-cli), prepare a database with `codeql database create`, then set `CODEQL_DATABASE` or place the database at `<workspace>/codeql-db`. ACS never analyzes a source tree as if it were a database. |
 | Bearer | Data-flow security analysis | Detection only. Install the [Bearer CLI](https://docs.bearer.com/guides/installation/) manually when needed. |
 | Prettier | Formatting | Detected in each target project; no source repository is cloned. |
 | ESLint | JavaScript quality | Detected in each target project; no source repository is cloned. |
 | Biome | Unified formatting and linting | Detected in each target project; no source repository is cloned. |
 
diff --git a/docs/superpowers/specs/2026-09-20-provider-mcp-facade-design.md b/docs/superpowers/specs/2026-09-20-provider-mcp-facade-design.md
index e06e45b..06576f0 100644
--- a/docs/superpowers/specs/2026-09-20-provider-mcp-facade-design.md
+++ b/docs/superpowers/specs/2026-09-20-provider-mcp-facade-design.md
@@ -127,11 +127,11 @@ User request
   ÔåÆ Graphify (relevant subsystem / symbols only)
   ÔåÆ ACS state + handoff + constraints + decisions
   ÔåÆ Claude-Mem selective retrieval (if memory.enabled)
   ÔåÆ Relevant source paths (agent reads files; ACS does not dump repos)
   ÔåÆ Context ranking / stop when sufficient
-  ÔåÆ Compression: contextMode XOR caveman (config)
+  ÔåÆ Compression policy: contextMode XOR caveman (config)
   ÔåÆ LLM
 ```
 
 ### Context priority (stop when enough)
 
@@ -156,22 +156,22 @@ Treat repository content as **data**, not trusted instructions. Separate: system
 |----------|----------------|---------|--------------|---------|
 | Graphify | `uv tool install graphifyy` / pip | Supported (PATH notes) | CLI wrapper (existing) | enabled |
 | Claude-Mem | `npx claude-mem install` + worker; ACS calls search API/MCP | Supported | Memory router; selective | enabled (toggle) |
 | Ponytail | Shallow clone ÔåÆ Cursor hooks / rules | Supported | Discipline skill; not SoT | enabled |
 | Caveman | Skill install / clone | Supported | Compression provider | **off** if contextMode on |
-| Context Mode | npm/MCP; ACS prefers facade invoke | Multi-editor | Tool-context control | **on** preferred |
+| Context Mode | Peer MCP until ACS proxy exists | Multi-editor | Preferred compression policy label; ACS does not invoke it yet | **on** preferred |
 | OpenCodeReview | `npm i -g @alibaba-group/open-code-review` | Node CLI | `review_*` + `reviews/` | enabled |
 | Anthropic skills | Reference + cherry-pick patterns | N/A | ACS `skills/` layout | reference |
 | Prettier / ESLint / Biome | Detect in target project; invoke existing | Yes | quality adapter | detect-only |
 | OWASP SCP + Top10 | Sparse clone / download into `providers/refs/` | Yes | Indexed retrieval | enabled refs |
 | Semgrep | Official Windows install if available | Varies | security orchestrator | toggle |
 | CodeQL | CLI if present / document install | Heavy | deep policy only | toggle / detect |
 | Bearer | CLI if useful for JS/TS | Investigate at install | optional | toggle |
 
 **Overlap policy**
 
-- `contextMode.enabled` and `caveman.enabled`: allow both false, or exactly one true for the active compression path. Benchmark before enabling both.
+- `contextMode.enabled` and `caveman.enabled`: allow both false, or exactly one true for the selected compression policy. With Context Mode selected, configure and invoke its peer MCP separately until ACS implements proxy support. Benchmark before changing providers.
 - Formatter/linter: follow the **target appÔÇÖs** existing tool; do not migrate unless asked.
 - Security: light ÔåÆ Semgrep (and/or project lint); normal ÔåÆ Semgrep + review; deep ÔåÆ add CodeQL/Bearer when configured.
 
 ## 9. Config (`config/system.json`)
 
diff --git a/src/mcp/tools.ts b/src/mcp/tools.ts
index 4dd159f..1301c31 100644
--- a/src/mcp/tools.ts
+++ b/src/mcp/tools.ts
@@ -246,12 +246,29 @@ export function createServer(): McpServer {
 
   server.tool(
     "provider_status",
     "Return configuration and local availability status for all optional providers.",
     {},
-    async () =>
-      textResult(JSON.stringify(getAllProviderStatuses(config), null, 2)),
+    async () => {
+      try {
+        return textResult(
+          JSON.stringify(getAllProviderStatuses(config), null, 2),
+        );
+      } catch (error) {
+        return textResult(
+          JSON.stringify(
+            {
+              error: "Provider status unavailable",
+              detail:
+                error instanceof Error ? error.message : String(error),
+            },
+            null,
+            2,
+          ),
+        );
+      }
+    },
   );
 
   server.tool(
     "memory_search",
     "Search the optional Claude-Mem index and return compact results with observation IDs. Claude-Mem is selective memory only; ACS remains the source of truth.",
@@ -281,11 +298,11 @@ export function createServer(): McpServer {
     async () => textResult(getDisciplineRules(config)),
   );
 
   server.tool(
     "compression_guidance",
-    "Return active compression guidance (context-mode vs caveman) and terse-output hints when caveman is enabled.",
+    "Return the preferred compression policy. Context Mode must be invoked as a separate peer MCP until ACS proxies it; caveman guidance is returned directly when enabled.",
     {},
     async () => textResult(getCavemanGuidance(config)),
   );
 
   server.tool(
diff --git a/src/orchestrator/finalizeTask.ts b/src/orchestrator/finalizeTask.ts
index 1e07e2e..6385d89 100644
--- a/src/orchestrator/finalizeTask.ts
+++ b/src/orchestrator/finalizeTask.ts
@@ -32,10 +32,16 @@ function checklistItem(
     .map((line) => `   ${line}`)
     .join("\n");
   return `- [${complete ? "x" : " "}] ${label}\n${indented}`;
 }
 
+function checkSucceeded(output: string): boolean {
+  return !/(?:\bfailed\b|\bfailure\b|\berror\b|\bskipped\b|\bmissing\b|\bnot (?:installed|configured|available)\b|\bunavailable\b|\binstall(?:ation)?(?:\s+hint)?\b|\bconflict\b|\brefused\b)/i.test(
+    output,
+  );
+}
+
 function requestedHandoff(args: FinalizeTaskArgs): HandoffUpdate | null {
   const direct: HandoffUpdate = {
     currentTask: args.currentTask,
     completed: args.completed,
     filesChanged: args.filesChanged,
@@ -105,42 +111,45 @@ export function finalizeTask(
 
   const build = runBuildValidation(config, args.workspacePath);
   report.push(checklistItem(!build.startsWith("Build: failed"), "Build", build));
 
   if (args.qualityCheck === true) {
+    const quality = runQualityCheck(args.workspacePath);
     report.push(
-      checklistItem(true, "Quality check", runQualityCheck(args.workspacePath)),
+      checklistItem(checkSucceeded(quality), "Quality check", quality),
     );
   } else {
     report.push(checklistItem(false, "Quality check", "Skipped: not requested."));
   }
 
   if (args.securityScan === true) {
+    const security = runSecurityScan(config, {
+      workspacePath: args.workspacePath,
+      policy: args.securityPolicy,
+    });
     report.push(
       checklistItem(
-        true,
+        checkSucceeded(security),
         "Security scan",
-        runSecurityScan(config, {
-          workspacePath: args.workspacePath,
-          policy: args.securityPolicy,
-        }),
+        security,
       ),
     );
   } else {
     report.push(checklistItem(false, "Security scan", "Skipped: not requested."));
   }
 
   if (args.review === true && config.review.openCodeReview.enabled) {
+    const review = runOpenCodeReview(config, {
+      workspacePath: args.workspacePath,
+      projectId: getProjectId(),
+      mode: "diff",
+    });
     report.push(
       checklistItem(
-        true,
+        checkSucceeded(review),
         "Review",
-        runOpenCodeReview(config, {
-          workspacePath: args.workspacePath,
-          projectId: getProjectId(),
-          mode: "diff",
-        }),
+        review,
       ),
     );
   } else {
     const reason =
       args.review === true ? "disabled in configuration" : "not requested";
diff --git a/src/providers/caveman.ts b/src/providers/caveman.ts
index 9ab2058..5a39c0d 100644
--- a/src/providers/caveman.ts
+++ b/src/providers/caveman.ts
@@ -15,10 +15,10 @@ export function getCavemanGuidance(config: SystemConfig): string {
   if (active === "caveman") {
     return CAVEMAN_GUIDANCE;
   }
 
   if (active === "context-mode") {
-    return "Context-mode is active; caveman compression is off. ACS uses context-mode for tool-output compression. Enable caveman only with contextMode disabled (mutually exclusive).";
+    return "Context Mode is the preferred compression policy; caveman is off. ACS currently selects this policy label but does not invoke or proxy Context Mode. Configure and invoke the Context Mode MCP separately until ACS adds proxy support. Enable caveman only with contextMode disabled (mutually exclusive).";
   }
 
-  return "No compression provider active; caveman is off. Enable context-mode (preferred) or caveman in config/system.json ÔÇö not both.";
+  return "No compression policy active; caveman is off. Enable Context Mode (preferred policy; invoke its MCP separately) or caveman in config/system.json ÔÇö not both.";
 }
diff --git a/src/providers/openCodeReview.ts b/src/providers/openCodeReview.ts
index 50d07f5..6850383 100644
--- a/src/providers/openCodeReview.ts
+++ b/src/providers/openCodeReview.ts
@@ -1,10 +1,10 @@
 import { execFileSync } from "node:child_process";
 import { mkdirSync, writeFileSync } from "node:fs";
-import { join } from "node:path";
+import { isAbsolute, join, relative, resolve } from "node:path";
 import type { SystemConfig } from "../core/config.js";
-import { reviewsDir } from "../core/paths.js";
+import { projectsDir, reviewsDir } from "../core/paths.js";
 import { cliAvailable } from "./which.js";
 
 const MAX_SUMMARY_CHARS = 4000;
 
 export type OpenCodeReviewMode = "diff" | "scan";
@@ -35,32 +35,52 @@ function timestampForFilename(): string {
 function truncate(text: string): string {
   if (text.length <= MAX_SUMMARY_CHARS) return text;
   return `${text.slice(0, MAX_SUMMARY_CHARS - 1)}ÔÇª`;
 }
 
+function safeReviewsDir(config: SystemConfig, projectId: string): string {
+  if (
+    !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(projectId) ||
+    projectId === "." ||
+    projectId === ".."
+  ) {
+    throw new Error("Invalid projectId: expected safe letters, digits, '.', '_' or '-' only.");
+  }
+
+  const root = resolve(projectsDir(config));
+  const outputDir = resolve(reviewsDir(config, projectId));
+  const fromRoot = relative(root, outputDir);
+  if (!fromRoot || fromRoot.startsWith("..") || isAbsolute(fromRoot)) {
+    throw new Error("Refused review path outside the managed projects directory.");
+  }
+  return outputDir;
+}
+
 export function runOpenCodeReview(
   config: SystemConfig,
   options: OpenCodeReviewOptions,
 ): string {
+  const outputDir = safeReviewsDir(config, options.projectId);
   if (!cliAvailable("ocr")) {
     return "OpenCodeReview is not installed. Install: npm install -g @alibaba-group/open-code-review";
   }
 
   const command = commandForMode(options.mode);
-  const outputDir = reviewsDir(config, options.projectId);
   mkdirSync(outputDir, { recursive: true });
 
   let output: string;
+  let succeeded = true;
   try {
     output = execFileSync("ocr", [command, "--format", "json"], {
       cwd: options.workspacePath,
       encoding: "utf8",
       stdio: ["ignore", "pipe", "pipe"],
       windowsHide: true,
       timeout: 300_000,
     }).trim();
   } catch (error) {
+    succeeded = false;
     const executionError = error as {
       stdout?: string;
       stderr?: string;
       message?: string;
     };
@@ -78,7 +98,9 @@ export function runOpenCodeReview(
     outputDir,
     `open-code-review-${options.mode}-${timestampForFilename()}.json`,
   );
   writeFileSync(outputPath, result, "utf8");
 
-  return `Review saved: ${outputPath}\n\n${truncate(result)}`;
+  return succeeded
+    ? `Review saved: ${outputPath}\n\n${truncate(result)}`
+    : `Review failed; diagnostic saved: ${outputPath}\n\n${truncate(result)}`;
 }
diff --git a/src/providers/ponytail.ts b/src/providers/ponytail.ts
index d077815..681814f 100644
--- a/src/providers/ponytail.ts
+++ b/src/providers/ponytail.ts
@@ -24,10 +24,14 @@ Safety carve-outs (never cut):
 - Correctness and anything explicitly requested
 
 Lazy about the solution, never about reading. Mark intentional shortcuts with a ponytail: comment naming the ceiling and upgrade path.`;
 
 export function getDisciplineRules(config: SystemConfig): string {
+  if (!config.ponytail.enabled) {
+    return "Ponytail discipline rules are disabled in config/system.json. Enable ponytail.enabled to use the implementation-discipline guidance.";
+  }
+
   const checkout = resolve(config.systemRoot, PONYTAIL_CHECKOUT);
   if (existsSync(checkout)) {
     return `${DISCIPLINE_LADDER}\n\nPonytail checkout: ${checkout}\nInstall Cursor hooks: node ${resolve(checkout, "scripts/cursor-hooks.js")} install`;
   }
   return `${DISCIPLINE_LADDER}\n\nPonytail checkout not found. Install: git clone --depth 1 https://github.com/DietrichGebert/ponytail.git ${checkout}`;
diff --git a/src/providers/quality.ts b/src/providers/quality.ts
index 9cfe711..58d4a9a 100644
--- a/src/providers/quality.ts
+++ b/src/providers/quality.ts
@@ -219,11 +219,11 @@ function runCommand(
       message?: string;
     };
     const stdout = execErr.stdout?.trim() ?? "";
     const stderr = execErr.stderr?.trim() ?? "";
     const body = [stdout, stderr].filter(Boolean).join("\n");
-    return `=== ${label} ===\n${body || execErr.message || "command failed"}`;
+    return `=== ${label} ===\nFailed: ${body || execErr.message || "command failed"}`;
   }
 }
 
 export function runQualityCheck(workspacePath: string): string {
   const stack = detectQualityStack(workspacePath);
diff --git a/src/security/scan.ts b/src/security/scan.ts
index cdd18f0..0aabbc2 100644
--- a/src/security/scan.ts
+++ b/src/security/scan.ts
@@ -1,6 +1,8 @@
 import { execFileSync } from "node:child_process";
+import { existsSync } from "node:fs";
+import { resolve } from "node:path";
 import type { SecurityPolicy, SystemConfig } from "../core/config.js";
 import { cliAvailable } from "../providers/which.js";
 
 const MAX_FINDINGS_CHARS = 3000;
 
@@ -91,11 +93,11 @@ function runTool(
     const output = [executionError.stdout, executionError.stderr]
       .filter(Boolean)
       .join("\n")
       .trim();
     const findings = structuredJson ? compactJson(output) : output;
-    return `=== ${label} ===\n${findings || executionError.message || "Scan failed."}`;
+    return `=== ${label} ===\nFailed: ${findings || executionError.message || "Scan failed."}`;
   }
 }
 
 function semgrepSection(config: SystemConfig, workspacePath: string): string {
   if (!config.security.semgrep.enabled) {
@@ -117,21 +119,39 @@ function reviewNote(): string {
   return "=== Review ===\nRun review_diff or review_scan for human-oriented security review.";
 }
 
 function deepSections(config: SystemConfig, workspacePath: string): string[] {
   const sections: string[] = [];
+  const configuredDatabase = process.env.CODEQL_DATABASE?.trim();
+  const defaultDatabase = resolve(workspacePath, "codeql-db");
+  const codeqlDatabase =
+    configuredDatabase && existsSync(configuredDatabase)
+      ? resolve(configuredDatabase)
+      : existsSync(defaultDatabase)
+        ? defaultDatabase
+        : null;
 
   if (!config.security.codeql.enabled) {
     sections.push("=== CodeQL ===\nSkipped: disabled in configuration.");
   } else if (!cliAvailable("codeql")) {
     sections.push("=== CodeQL ===\nSkipped: CLI unavailable.");
+  } else if (!codeqlDatabase) {
+    sections.push(
+      "=== CodeQL ===\nSkipped: no prepared CodeQL database. Create one with `codeql database create <database-path> --source-root <workspace>` and set CODEQL_DATABASE to that path, or place it at <workspace>/codeql-db.",
+    );
   } else {
     sections.push(
       runTool(
         "CodeQL",
         "codeql",
-        ["database", "analyze", ".", "--format=csv", "--output=-"],
+        [
+          "database",
+          "analyze",
+          codeqlDatabase,
+          "--format=csv",
+          "--output=-",
+        ],
         workspacePath,
         false,
       ),
     );
   }
diff --git a/tests/compression.test.ts b/tests/compression.test.ts
index 544d3f6..324632e 100644
--- a/tests/compression.test.ts
+++ b/tests/compression.test.ts
@@ -38,10 +38,26 @@ describe("compression policy", () => {
     const c = base({
       contextMode: { enabled: false },
       caveman: { enabled: true },
     });
     expect(activeCompressionProvider(c)).toBe("caveman");
+    expect(assertCompressionPolicy(c)).toEqual({
+      ok: true,
+      detail: "active compression: caveman",
+    });
+  });
+
+  it("supports no active compression provider", () => {
+    const c = base({
+      contextMode: { enabled: false },
+      caveman: { enabled: false },
+    });
+    expect(activeCompressionProvider(c)).toBe("none");
+    expect(assertCompressionPolicy(c)).toEqual({
+      ok: true,
+      detail: "active compression: none",
+    });
   });
 
   it("warns when both enabled (overlap)", () => {
     const c = base({
       contextMode: { enabled: true },
diff --git a/tests/discipline-rules.test.ts b/tests/discipline-rules.test.ts
index a33f019..96b2b63 100644
--- a/tests/discipline-rules.test.ts
+++ b/tests/discipline-rules.test.ts
@@ -45,16 +45,27 @@ describe("discipline rules", () => {
     const rules = getDisciplineRules(base());
     if (rules.toLowerCase().includes("checkout")) {
       expect(rules).toContain("providers\\skills\\ponytail");
     }
   });
+
+  it("returns a disabled message when ponytail is off", () => {
+    const rules = getDisciplineRules(
+      base({ ponytail: { enabled: false } }),
+    );
+
+    expect(rules.toLowerCase()).toContain("disabled");
+    expect(rules).not.toContain("1. Does this need to exist?");
+  });
 });
 
 describe("compression guidance", () => {
-  it("reports context-mode active when caveman disabled", () => {
+  it("reports Context Mode as a peer preferred policy", () => {
     const guidance = getCavemanGuidance(base());
-    expect(guidance.toLowerCase()).toContain("context-mode");
+    expect(guidance.toLowerCase()).toMatch(/context[ -]mode/);
+    expect(guidance.toLowerCase()).toContain("separately");
+    expect(guidance.toLowerCase()).toContain("does not invoke");
     expect(guidance.toLowerCase()).toMatch(/caveman.*off|off.*caveman/);
   });
 
   it("returns terse-output guidance when caveman is active", () => {
     const guidance = getCavemanGuidance(
diff --git a/tests/finalize-task.test.ts b/tests/finalize-task.test.ts
index 715022b..ed8e2fb 100644
--- a/tests/finalize-task.test.ts
+++ b/tests/finalize-task.test.ts
@@ -124,6 +124,40 @@ describe("finalizeTask", () => {
     expect(mocks.runOpenCodeReview).not.toHaveBeenCalled();
     expect(mocks.rmSync).not.toHaveBeenCalled();
     expect(result).toContain("disabled in configuration");
     expect(result).toContain("Refused:");
   });
+
+  it("leaves unsuccessful requested checks incomplete", () => {
+    mocks.runQualityCheck.mockReturnValue("Quality tool conflict detected. Skipped auto-run.");
+    mocks.runSecurityScan.mockReturnValue(
+      "=== Semgrep ===\nSkipped: CLI unavailable.",
+    );
+    mocks.runOpenCodeReview.mockReturnValue(
+      "OpenCodeReview is not installed. Install: npm install -g @alibaba-group/open-code-review",
+    );
+
+    const result = finalizeTask(config(), {
+      workspacePath: "D:\\app",
+      qualityCheck: true,
+      securityScan: true,
+      review: true,
+    });
+
+    expect(result).toContain("- [ ] Quality check");
+    expect(result).toContain("- [ ] Security scan");
+    expect(result).toContain("- [ ] Review");
+  });
+
+  it("marks command error output incomplete", () => {
+    mocks.runOpenCodeReview.mockReturnValue(
+      "Review saved: review.json\n\nError: OCR exited with status 1",
+    );
+
+    const result = finalizeTask(config(), {
+      workspacePath: "D:\\app",
+      review: true,
+    });
+
+    expect(result).toContain("- [ ] Review");
+  });
 });
diff --git a/tests/review-paths.test.ts b/tests/review-paths.test.ts
index 48aede4..ff67c5d 100644
--- a/tests/review-paths.test.ts
+++ b/tests/review-paths.test.ts
@@ -124,6 +124,42 @@ describe("OpenCodeReview output paths", () => {
     expect(result).toContain(
       "npm install -g @alibaba-group/open-code-review",
     );
     expect(execFileSync).not.toHaveBeenCalled();
   });
+
+  it("reports a non-zero OCR exit as failed", () => {
+    vi.mocked(execFileSync).mockImplementationOnce(() => {
+      throw Object.assign(new Error("ocr exited with status 1"), {
+        stderr: "scanner crashed",
+      });
+    });
+
+    const result = runOpenCodeReview(
+      makeConfig(makeTemp("acs-review-failed-")),
+      {
+        workspacePath: makeTemp("acs-review-failed-workspace-"),
+        projectId: "project-123",
+        mode: "diff",
+      },
+    );
+
+    expect(result).toContain("Review failed; diagnostic saved:");
+    expect(result).toContain("scanner crashed");
+  });
+
+  it.each(["..\\outside", "../outside", "project/../../outside"])(
+    "refuses unsafe projectId %s",
+    (projectId) => {
+      const config = makeConfig(makeTemp("acs-review-traversal-"));
+
+      expect(() =>
+        runOpenCodeReview(config, {
+          workspacePath: makeTemp("acs-review-workspace-"),
+          projectId,
+          mode: "diff",
+        }),
+      ).toThrow(/invalid projectId|outside the managed projects/i);
+      expect(execFileSync).not.toHaveBeenCalled();
+    },
+  );
 });
diff --git a/tests/security-scan.test.ts b/tests/security-scan.test.ts
index 3a82549..63a4eb0 100644
--- a/tests/security-scan.test.ts
+++ b/tests/security-scan.test.ts
@@ -1,15 +1,20 @@
 import { execFileSync } from "node:child_process";
+import { existsSync } from "node:fs";
 import { beforeEach, describe, expect, it, vi } from "vitest";
 import type { SystemConfig } from "../src/core/config.js";
 import { cliAvailable } from "../src/providers/which.js";
 import { runSecurityScan } from "../src/security/scan.js";
 
 vi.mock("../src/providers/which.js", () => ({
   cliAvailable: vi.fn(() => true),
 }));
 
+vi.mock("node:fs", () => ({
+  existsSync: vi.fn(() => false),
+}));
+
 vi.mock("node:child_process", () => ({
   execFileSync: vi.fn((command: string) => {
     if (command === "semgrep") {
       return JSON.stringify({
         results: [
@@ -54,10 +59,12 @@ function config(
 }
 
 beforeEach(() => {
   vi.clearAllMocks();
   vi.mocked(cliAvailable).mockReturnValue(true);
+  vi.mocked(existsSync).mockReturnValue(false);
+  delete process.env.CODEQL_DATABASE;
 });
 
 describe("runSecurityScan", () => {
   it("runs Semgrep first for light policy and summarizes JSON", () => {
     const result = runSecurityScan(config(), {
@@ -83,10 +90,13 @@ describe("runSecurityScan", () => {
     expect(result).toContain("Security policy: normal");
     expect(result).toContain("review_diff or review_scan");
   });
 
   it("runs enabled and available deep scanners", () => {
+    vi.mocked(existsSync).mockImplementation((path) =>
+      String(path).endsWith("codeql-db"),
+    );
     const result = runSecurityScan(
       config({
         codeql: { enabled: true },
         bearer: { enabled: true },
         defaultPolicy: "deep",
@@ -94,11 +104,17 @@ describe("runSecurityScan", () => {
       { workspacePath: "C:\\workspace" },
     );
 
     expect(execFileSync).toHaveBeenCalledWith(
       "codeql",
-      ["database", "analyze", ".", "--format=csv", "--output=-"],
+      [
+        "database",
+        "analyze",
+        expect.stringMatching(/codeql-db$/),
+        "--format=csv",
+        "--output=-",
+      ],
       expect.any(Object),
     );
     expect(execFileSync).toHaveBeenCalledWith(
       "bearer",
       ["scan", ".", "--format", "json"],
@@ -106,10 +122,28 @@ describe("runSecurityScan", () => {
     );
     expect(result).toContain("=== CodeQL ===");
     expect(result).toContain("=== Bearer ===");
   });
 
+  it("skips CodeQL with preparation instructions when no database exists", () => {
+    const result = runSecurityScan(
+      config({
+        codeql: { enabled: true },
+        defaultPolicy: "deep",
+      }),
+      { workspacePath: "C:\\workspace" },
+    );
+
+    expect(result).toContain("no prepared CodeQL database");
+    expect(result).toContain("CODEQL_DATABASE");
+    expect(execFileSync).not.toHaveBeenCalledWith(
+      "codeql",
+      expect.anything(),
+      expect.anything(),
+    );
+  });
+
   it("reports skipped scanners when disabled or unavailable", () => {
     vi.mocked(cliAvailable).mockReturnValue(false);
 
     const result = runSecurityScan(
       config({
