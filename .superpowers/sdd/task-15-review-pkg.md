# T15
BASE: 558234bf069214f601c30fbd1602fcdc27543821
HEAD: 797dce3a74672329beb6683b3a371e5d0bcb8d41
## Commits
797dce3 chore: verify provider MCP facade P0-P5
## Stat
 .superpowers/sdd/task-15-report.md                 | 37 ++++++++++++++++++
 .../specs/2026-09-20-provider-mcp-facade-design.md |  2 +-
 tests/identity-context.test.ts                     | 45 ++++++++++++++++++++++
 3 files changed, 83 insertions(+), 1 deletion(-)
## Diff
diff --git a/.superpowers/sdd/task-15-report.md b/.superpowers/sdd/task-15-report.md
new file mode 100644
index 0000000..c21a007
--- /dev/null
+++ b/.superpowers/sdd/task-15-report.md
@@ -0,0 +1,37 @@
+# Task 15 Report: Full verification
+
+## Status
+
+DONE
+
+## Changes
+
+- Added a `buildProjectContext` regression assertion proving project memory dumps and OWASP reference dumps are not included in the canonical project context.
+- Completed the `SystemConfig` fixture in `identity-context.test.ts` with the provider facade fields.
+- Updated the provider MCP facade design status to `Implemented (phased)`.
+
+## Command results
+
+- `npm test`
+  - Initial invocation failed because npm could not resolve its child `node` executable.
+  - Rerun with `C:\Program Files\nodejs` on `PATH`: PASS.
+  - 14 test files passed; 51 tests passed.
+- `npm run build`
+  - PASS (`tsc`, exit 0).
+- `npm run doctor`
+  - Initial invocation lacked Git/global npm paths and exited 1.
+  - Rerun with Node, Git, and `%APPDATA%\npm` on `PATH`: PASS (exit 0).
+  - Required checks passed. Optional warnings remain for Graphify, Claude-Mem availability probing, Context Mode availability probing, Semgrep, and target-project quality CLIs.
+- `scripts/install-providers.ps1 -SkipHeavy`
+  - Completed successfully (exit 0).
+  - Context Mode, OpenCodeReview, Ponytail, Caveman, OWASP SCP, and OWASP Top 10 were already present.
+  - Graphify install soft-failed because Python resolved to an unavailable Windows app alias; Claude-Mem, CodeQL, and Bearer remain manual; Semgrep was intentionally skipped.
+
+## Concerns
+
+- npm reports an unknown `devdir` environment config warning.
+- Optional provider gaps are truthfully reported and do not fail doctor health.
+
+## Commit
+
+- `chore: verify provider MCP facade P0-P5`
diff --git a/docs/superpowers/specs/2026-09-20-provider-mcp-facade-design.md b/docs/superpowers/specs/2026-09-20-provider-mcp-facade-design.md
index 376e8b9..e06e45b 100644
--- a/docs/superpowers/specs/2026-09-20-provider-mcp-facade-design.md
+++ b/docs/superpowers/specs/2026-09-20-provider-mcp-facade-design.md
@@ -1,7 +1,7 @@
 # AI Coding System ÔÇö Provider MCP Facade Design
 
 **Date:** 2026-09-20  
-**Status:** Approved ÔÇö implementation plan ready (`docs/superpowers/plans/2026-09-20-provider-mcp-facade.md`)
+**Status:** Implemented (phased)
 **Location:** `C:\AI-Coding-System`
 
 ## 1. Purpose
diff --git a/tests/identity-context.test.ts b/tests/identity-context.test.ts
index d458bf4..e7f6f1c 100644
--- a/tests/identity-context.test.ts
+++ b/tests/identity-context.test.ts
@@ -53,6 +53,18 @@ function makeSystem(root: string): SystemConfig {
         projectRoots: ["D:\\"],
         identity: { hashLength: 20 },
         graphify: { enabled: true, preferCodeOnly: true },
+        memory: { enabled: true, provider: "claude-mem" },
+        ponytail: { enabled: true },
+        caveman: { enabled: false },
+        contextMode: { enabled: true },
+        review: { openCodeReview: { enabled: true } },
+        security: {
+          semgrep: { enabled: true },
+          codeql: { enabled: false },
+          bearer: { enabled: false },
+          defaultPolicy: "light",
+        },
+        validation: { maxBuildAttempts: 3 },
         telemetry: { enabled: false },
       },
       null,
@@ -64,6 +76,18 @@ function makeSystem(root: string): SystemConfig {
     projectRoots: ["D:\\"],
     identity: { hashLength: 20 },
     graphify: { enabled: true, preferCodeOnly: true },
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
     telemetry: { enabled: false },
   };
 }
@@ -133,6 +157,27 @@ describe("register + context", () => {
     expect(ctx.context).toContain(first.meta.projectId);
     expect(ctx.context).toContain("Add login");
 
+    const memorySentinel = "CLAUDE_MEM_FULL_DUMP_SENTINEL";
+    const owaspSentinel = "OWASP_FULL_GUIDE_SENTINEL";
+    const memoryDir = join(
+      systemRoot,
+      "projects",
+      first.meta.projectId,
+      "memory",
+    );
+    const owaspDir = join(systemRoot, "providers", "refs", "owasp-top10");
+    mkdirSync(memoryDir, { recursive: true });
+    mkdirSync(owaspDir, { recursive: true });
+    writeFileSync(join(memoryDir, "full-dump.md"), memorySentinel);
+    writeFileSync(join(owaspDir, "full-guide.md"), owaspSentinel);
+
+    const isolatedCtx = buildProjectContext(config, {
+      projectId: first.meta.projectId,
+      includeGit: false,
+    });
+    expect(isolatedCtx.context).not.toContain(memorySentinel);
+    expect(isolatedCtx.context).not.toContain(owaspSentinel);
+
     const listed = listProjects(config);
     expect(listed.some((p) => p.projectId === first.meta.projectId)).toBe(true);
   });
