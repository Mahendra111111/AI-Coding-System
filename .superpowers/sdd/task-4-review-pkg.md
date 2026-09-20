# Review package Task 4
BASE: f2a89cb5745477fe59df0bc3933cc90f5988dd6d
HEAD: 4b55ae91a716120f06be63b746ad15f284822ff7

## Commits
4b55ae9 feat: provider status surface in doctor and MCP

## Stat
 src/doctor.ts                 | 26 +++++++++++-
 src/mcp/tools.ts              | 11 ++++-
 src/providers/status.ts       | 94 +++++++++++++++++++++++++++++++++++++++++++
 tests/provider-status.test.ts | 32 +++++++++++++++
 4 files changed, 160 insertions(+), 3 deletions(-)

## Diff
diff --git a/src/doctor.ts b/src/doctor.ts
index 6df2baf..dd5f5b8 100644
--- a/src/doctor.ts
+++ b/src/doctor.ts
@@ -1,14 +1,15 @@
 import { spawnSync } from "node:child_process";
 import { existsSync } from "node:fs";
 import { join } from "node:path";
 import type { SystemConfig } from "./core/config.js";
 import { isGraphifyAvailable } from "./graph/graphify.js";
 import { projectsDir, registryPath, templatesDir } from "./core/paths.js";
+import { getAllProviderStatuses } from "./providers/status.js";
 
 export interface DoctorCheck {
   name: string;
   ok: boolean;
   detail: string;
 }
 
 function which(cmd: string): boolean {
@@ -78,19 +79,40 @@ export function runDoctor(config: SystemConfig): {
     ok: graphifyOk || !config.graphify.enabled,
     detail: graphifyOk
       ? "graphify CLI available"
       : config.graphify.enabled
         ? "optional ÔÇö not installed (uv tool install graphifyy)"
         : "disabled in config",
   });
 
-  // graphify optional: don't fail overall if missing
+  try {
+    const providerChecks = getAllProviderStatuses(config).map((provider) => ({
+      name: `provider:${provider.id}`,
+      ok:
+        !provider.enabledInConfig ||
+        (provider.available && !provider.detail.includes("overlap:")),
+      detail: provider.detail,
+    }));
+    checks.push(...providerChecks);
+  } catch (error) {
+    checks.push({
+      name: "provider_registry",
+      ok: false,
+      detail: `optional provider status unavailable: ${error instanceof Error ? error.message : String(error)}`,
+    });
+  }
+
+  // Optional providers, including graphify, don't fail overall health.
   const requiredFailed = checks.filter(
-    (c) => !c.ok && c.name !== "graphify",
+    (c) =>
+      !c.ok &&
+      c.name !== "graphify" &&
+      c.name !== "provider_registry" &&
+      !c.name.startsWith("provider:"),
   );
   const ok = requiredFailed.length === 0;
   const summary = checks
     .map((c) => `${c.ok ? "OK" : "WARN"}  ${c.name}: ${c.detail}`)
     .join("\n");
 
   return { ok, checks, summary };
 }
diff --git a/src/mcp/tools.ts b/src/mcp/tools.ts
index cf63595..b7bdbaf 100644
--- a/src/mcp/tools.ts
+++ b/src/mcp/tools.ts
@@ -15,16 +15,17 @@ import {
   registerProject,
   resolveProjectId,
 } from "../project/register.js";
 import {
   readHandoff,
   updateHandoff,
   updateProjectState,
 } from "../project/state.js";
+import { getAllProviderStatuses } from "../providers/status.js";
 
 function textResult(text: string) {
   return { content: [{ type: "text" as const, text }] };
 }
 
 export function createServer(): McpServer {
   const config = loadConfig();
   const server = new McpServer({
@@ -196,26 +197,34 @@ export function createServer(): McpServer {
     },
     async ({ workspacePath }) => {
       return textResult(formatGitSummary(getGitSummary(workspacePath)));
     },
   );
 
   server.tool(
     "doctor",
-    "Check AI Coding System health (Node, git, build, templates, optional Graphify).",
+    "Check AI Coding System health, including optional provider status.",
     {},
     async () => {
       const result = runDoctor(config);
       return textResult(
         `${result.ok ? "HEALTHY" : "ISSUES FOUND"}\n\n${result.summary}`,
       );
     },
   );
 
+  server.tool(
+    "provider_status",
+    "Return configuration and local availability status for all optional providers.",
+    {},
+    async () =>
+      textResult(JSON.stringify(getAllProviderStatuses(config), null, 2)),
+  );
+
   if (config.graphify.enabled) {
     server.tool(
       "graph_query",
       "Query Graphify knowledge graph for the workspace (optional; requires graphify CLI).",
       {
         workspacePath: z.string(),
         question: z.string(),
       },
diff --git a/src/providers/status.ts b/src/providers/status.ts
new file mode 100644
index 0000000..5be86af
--- /dev/null
+++ b/src/providers/status.ts
@@ -0,0 +1,94 @@
+import { existsSync } from "node:fs";
+import { resolve } from "node:path";
+import type { SystemConfig } from "../core/config.js";
+import { assertCompressionPolicy } from "./compression.js";
+import { loadProviderRegistry } from "./registry.js";
+import type { ProviderEntry, ProviderRole } from "./types.js";
+import { cliAvailable } from "./which.js";
+
+export interface ProviderStatusRow {
+  id: string;
+  role: ProviderRole;
+  enabledInConfig: boolean;
+  available: boolean;
+  detail: string;
+}
+
+function enabledInConfig(config: SystemConfig, id: string): boolean {
+  switch (id) {
+    case "graphify":
+      return config.graphify.enabled;
+    case "claude-mem":
+      return config.memory.enabled;
+    case "ponytail":
+      return config.ponytail.enabled;
+    case "caveman":
+      return config.caveman.enabled;
+    case "context-mode":
+      return config.contextMode.enabled;
+    case "open-code-review":
+      return config.review.openCodeReview.enabled;
+    case "semgrep":
+      return config.security.semgrep.enabled;
+    case "codeql":
+      return config.security.codeql.enabled;
+    case "bearer":
+      return config.security.bearer.enabled;
+    default:
+      return true;
+  }
+}
+
+function availability(
+  config: SystemConfig,
+  provider: ProviderEntry,
+): { available: boolean; detail: string } {
+  if (provider.cli) {
+    const available = cliAvailable(provider.cli);
+    return {
+      available,
+      detail: available
+        ? `CLI available: ${provider.cli}`
+        : `CLI missing: ${provider.cli}; install: ${provider.install}`,
+    };
+  }
+
+  if (provider.checkout) {
+    const checkout = resolve(config.systemRoot, provider.checkout);
+    const available = existsSync(checkout);
+    return {
+      available,
+      detail: available
+        ? `Checkout available: ${checkout}`
+        : `Checkout missing: ${checkout}; install: ${provider.install}`,
+    };
+  }
+
+  return {
+    available: false,
+    detail: `No local availability probe; install: ${provider.install}`,
+  };
+}
+
+export function getAllProviderStatuses(
+  config: SystemConfig,
+): ProviderStatusRow[] {
+  const compressionPolicy = assertCompressionPolicy(config);
+
+  return loadProviderRegistry(config).providers.map((provider) => {
+    const enabled = enabledInConfig(config, provider.id);
+    const status = availability(config, provider);
+    const compressionDetail =
+      provider.id === "context-mode" || provider.id === "caveman"
+        ? `; ${compressionPolicy.detail}`
+        : "";
+
+    return {
+      id: provider.id,
+      role: provider.role,
+      enabledInConfig: enabled,
+      available: status.available,
+      detail: `${enabled ? "enabled" : "disabled"}; ${status.detail}${compressionDetail}`,
+    };
+  });
+}
diff --git a/tests/provider-status.test.ts b/tests/provider-status.test.ts
new file mode 100644
index 0000000..6bbce46
--- /dev/null
+++ b/tests/provider-status.test.ts
@@ -0,0 +1,32 @@
+import { describe, expect, it } from "vitest";
+import type { SystemConfig } from "../src/core/config.js";
+import { loadConfig } from "../src/core/config.js";
+import { getAllProviderStatuses } from "../src/providers/status.js";
+
+describe("provider status", () => {
+  it("reports every registered provider", () => {
+    const statuses = getAllProviderStatuses(loadConfig());
+
+    expect(statuses.length).toBeGreaterThanOrEqual(14);
+    expect(statuses.every((status) => status.id && status.role)).toBe(true);
+  });
+
+  it("surfaces compression overlap", () => {
+    const config: SystemConfig = {
+      ...loadConfig(),
+      contextMode: { enabled: true },
+      caveman: { enabled: true },
+    };
+    const statuses = getAllProviderStatuses(config);
+    const compressionStatuses = statuses.filter(
+      (status) => status.id === "context-mode" || status.id === "caveman",
+    );
+
+    expect(compressionStatuses).toHaveLength(2);
+    expect(
+      compressionStatuses.some((status) =>
+        status.detail.toLowerCase().includes("overlap"),
+      ),
+    ).toBe(true);
+  });
+});
