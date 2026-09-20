# T6
BASE: 5b1207519ec44bd1e95599c6208fa14c5d46e88f
HEAD: adb605da753227a501ef4dba4e43fc50083e516a
## Commits
adb605d feat: expose ponytail discipline and compression guidance tools
## Stat
 .gitignore                     |  3 +-
 providers/skills/README.md     | 40 ++++++++++++++++++++++++
 src/mcp/tools.ts               | 16 ++++++++++
 src/providers/caveman.ts       | 24 ++++++++++++++
 src/providers/ponytail.ts      | 34 ++++++++++++++++++++
 tests/discipline-rules.test.ts | 71 ++++++++++++++++++++++++++++++++++++++++++
 6 files changed, 187 insertions(+), 1 deletion(-)
## Diff
diff --git a/.gitignore b/.gitignore
index 0f30c64..87774f2 100644
--- a/.gitignore
+++ b/.gitignore
@@ -1,13 +1,14 @@
 node_modules/
 dist/
 projects/*/temp/
 projects/*/cache/
 temp-smoke-workspace/
 tools/venvs/
-providers/skills/
+providers/skills/*
+!providers/skills/README.md
 providers/refs/
 *.log
 .DS_Store
 Thumbs.db
 .env
 .env.*
diff --git a/providers/skills/README.md b/providers/skills/README.md
new file mode 100644
index 0000000..1f681e4
--- /dev/null
+++ b/providers/skills/README.md
@@ -0,0 +1,40 @@
+# Provider skill checkouts
+
+Optional skill packs are shallow-cloned here by `scripts/install-providers.ps1`.
+
+## Ponytail (implementation discipline)
+
+After checkout exists at `providers/skills/ponytail`:
+
+```powershell
+# From AI-Coding-System root
+node providers\skills\ponytail\scripts\cursor-hooks.js install
+```
+
+Project-scoped hooks instead of global:
+
+```powershell
+node providers\skills\ponytail\scripts\cursor-hooks.js install --project
+```
+
+Requires `node` on PATH. Cursor reloads `hooks.json` on save; open a new chat for rules to apply.
+
+Uninstall ponytail hook entries only:
+
+```powershell
+node providers\skills\ponytail\scripts\cursor-hooks.js uninstall
+```
+
+If a workspace `.cursor/rules/ponytail.mdc` rule is present, hooks stay quiet ÔÇö remove that rule to let hooks manage the level.
+
+Install checkout if missing:
+
+```powershell
+.\scripts\install-providers.ps1
+```
+
+Or manually:
+
+```powershell
+git clone --depth 1 https://github.com/DietrichGebert/ponytail.git providers\skills\ponytail
+```
diff --git a/src/mcp/tools.ts b/src/mcp/tools.ts
index b7bdbaf..d293c29 100644
--- a/src/mcp/tools.ts
+++ b/src/mcp/tools.ts
@@ -17,12 +17,14 @@ import {
 } from "../project/register.js";
 import {
   readHandoff,
   updateHandoff,
   updateProjectState,
 } from "../project/state.js";
+import { getCavemanGuidance } from "../providers/caveman.js";
+import { getDisciplineRules } from "../providers/ponytail.js";
 import { getAllProviderStatuses } from "../providers/status.js";
 
 function textResult(text: string) {
   return { content: [{ type: "text" as const, text }] };
 }
 
@@ -217,12 +219,26 @@ export function createServer(): McpServer {
     "Return configuration and local availability status for all optional providers.",
     {},
     async () =>
       textResult(JSON.stringify(getAllProviderStatuses(config), null, 2)),
   );
 
+  server.tool(
+    "discipline_rules",
+    "Return compact Ponytail YAGNI ladder and safety carve-outs for implementation discipline.",
+    {},
+    async () => textResult(getDisciplineRules(config)),
+  );
+
+  server.tool(
+    "compression_guidance",
+    "Return active compression guidance (context-mode vs caveman) and terse-output hints when caveman is enabled.",
+    {},
+    async () => textResult(getCavemanGuidance(config)),
+  );
+
   if (config.graphify.enabled) {
     server.tool(
       "graph_query",
       "Query Graphify knowledge graph for the workspace (optional; requires graphify CLI).",
       {
         workspacePath: z.string(),
diff --git a/src/providers/caveman.ts b/src/providers/caveman.ts
new file mode 100644
index 0000000..9ab2058
--- /dev/null
+++ b/src/providers/caveman.ts
@@ -0,0 +1,24 @@
+import type { SystemConfig } from "../core/config.js";
+import { activeCompressionProvider } from "./compression.js";
+
+const CAVEMAN_GUIDANCE = `Caveman compression active (ACS guidance)
+
+Respond terse: drop filler, hedging, and pleasantries; fragments OK. Keep code blocks, commands, paths, and error messages byte-for-byte exact.
+
+Never compress: security warnings, irreversible actions, or technical substance.
+Levels: lite (tight sentences), full (classic caveman), ultra (maximum terseness).
+Caveman shrinks what the agent says; pair with Ponytail discipline_rules for what it builds.`;
+
+export function getCavemanGuidance(config: SystemConfig): string {
+  const active = activeCompressionProvider(config);
+
+  if (active === "caveman") {
+    return CAVEMAN_GUIDANCE;
+  }
+
+  if (active === "context-mode") {
+    return "Context-mode is active; caveman compression is off. ACS uses context-mode for tool-output compression. Enable caveman only with contextMode disabled (mutually exclusive).";
+  }
+
+  return "No compression provider active; caveman is off. Enable context-mode (preferred) or caveman in config/system.json ÔÇö not both.";
+}
diff --git a/src/providers/ponytail.ts b/src/providers/ponytail.ts
new file mode 100644
index 0000000..d077815
--- /dev/null
+++ b/src/providers/ponytail.ts
@@ -0,0 +1,34 @@
+import { existsSync } from "node:fs";
+import { resolve } from "node:path";
+import type { SystemConfig } from "../core/config.js";
+
+const PONYTAIL_CHECKOUT = "providers/skills/ponytail";
+
+const DISCIPLINE_LADDER = `Ponytail implementation discipline (ACS compact copy)
+
+Before writing code, stop at the first rung that holds. Read the task and the code it touches first; trace the real flow, then climb.
+
+1. Does this need to exist? ÔåÆ no: skip it (YAGNI)
+2. Already in this codebase? ÔåÆ reuse it, don't rewrite
+3. Stdlib does it? ÔåÆ use it
+4. Native platform feature? ÔåÆ use it
+5. Installed dependency solves it? ÔåÆ use it
+6. One line? ÔåÆ one line
+7. Only then: the minimum code that works
+
+Safety carve-outs (never cut):
+- Input validation at trust boundaries
+- Error handling that prevents data loss
+- Security controls
+- Accessibility requirements
+- Correctness and anything explicitly requested
+
+Lazy about the solution, never about reading. Mark intentional shortcuts with a ponytail: comment naming the ceiling and upgrade path.`;
+
+export function getDisciplineRules(config: SystemConfig): string {
+  const checkout = resolve(config.systemRoot, PONYTAIL_CHECKOUT);
+  if (existsSync(checkout)) {
+    return `${DISCIPLINE_LADDER}\n\nPonytail checkout: ${checkout}\nInstall Cursor hooks: node ${resolve(checkout, "scripts/cursor-hooks.js")} install`;
+  }
+  return `${DISCIPLINE_LADDER}\n\nPonytail checkout not found. Install: git clone --depth 1 https://github.com/DietrichGebert/ponytail.git ${checkout}`;
+}
diff --git a/tests/discipline-rules.test.ts b/tests/discipline-rules.test.ts
new file mode 100644
index 0000000..a33f019
--- /dev/null
+++ b/tests/discipline-rules.test.ts
@@ -0,0 +1,71 @@
+import { describe, expect, it } from "vitest";
+import type { SystemConfig } from "../src/core/config.js";
+import { getCavemanGuidance } from "../src/providers/caveman.js";
+import { getDisciplineRules } from "../src/providers/ponytail.js";
+
+function base(partial: Partial<SystemConfig> = {}): SystemConfig {
+  return {
+    systemRoot: "C:\\AI-Coding-System",
+    projectRoots: ["D:\\"],
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
+    ...partial,
+  };
+}
+
+describe("discipline rules", () => {
+  it("returns non-empty ponytail ladder with safety carve-outs", () => {
+    const rules = getDisciplineRules(base());
+
+    expect(rules.length).toBeGreaterThan(100);
+    expect(rules.toLowerCase()).toContain("yagni");
+    for (let i = 1; i <= 7; i += 1) {
+      expect(rules).toMatch(new RegExp(`\\b${i}\\.`));
+    }
+    expect(rules.toLowerCase()).toContain("security");
+    expect(rules.toLowerCase()).toContain("accessibility");
+    expect(rules.toLowerCase()).toContain("validation");
+    expect(rules.toLowerCase()).toContain("error handling");
+  });
+
+  it("mentions ponytail checkout path when present", () => {
+    const rules = getDisciplineRules(base());
+    if (rules.toLowerCase().includes("checkout")) {
+      expect(rules).toContain("providers\\skills\\ponytail");
+    }
+  });
+});
+
+describe("compression guidance", () => {
+  it("reports context-mode active when caveman disabled", () => {
+    const guidance = getCavemanGuidance(base());
+    expect(guidance.toLowerCase()).toContain("context-mode");
+    expect(guidance.toLowerCase()).toMatch(/caveman.*off|off.*caveman/);
+  });
+
+  it("returns terse-output guidance when caveman is active", () => {
+    const guidance = getCavemanGuidance(
+      base({
+        contextMode: { enabled: false },
+        caveman: { enabled: true },
+      }),
+    );
+
+    expect(guidance.toLowerCase()).toContain("caveman");
+    expect(guidance.toLowerCase()).toMatch(/terse|brief|compress|filler/);
+    expect(guidance.toLowerCase()).not.toContain("context-mode is active");
+  });
+});
