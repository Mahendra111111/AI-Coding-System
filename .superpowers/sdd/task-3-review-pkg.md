# Review package Task 3
BASE: f273688f6a3b0ed6af449cf169a7c9edf618be8f
HEAD: f2a89cb5745477fe59df0bc3933cc90f5988dd6d

## Commits
f2a89cb feat: add provider registry and path helpers

## Stat
 providers/registry.json         | 102 ++++++++++++++++++++++++++++++++++++++++
 src/core/paths.ts               |  16 +++++++
 src/providers/registry.ts       |  17 +++++++
 src/providers/types.ts          |  26 ++++++++++
 src/providers/which.ts          |  15 ++++++
 tests/provider-registry.test.ts |  49 +++++++++++++++++++
 6 files changed, 225 insertions(+)

## Diff
diff --git a/providers/registry.json b/providers/registry.json
new file mode 100644
index 0000000..de1a196
--- /dev/null
+++ b/providers/registry.json
@@ -0,0 +1,102 @@
+{
+  "providers": [
+    {
+      "id": "graphify",
+      "role": "code-structure",
+      "install": "uv tool install graphifyy",
+      "cli": "graphify",
+      "checkout": null
+    },
+    {
+      "id": "claude-mem",
+      "role": "historical-memory",
+      "install": "npx claude-mem install --provider host",
+      "cli": null,
+      "checkout": null
+    },
+    {
+      "id": "ponytail",
+      "role": "implementation-discipline",
+      "install": "git clone --depth 1 https://github.com/DietrichGebert/ponytail.git providers/skills/ponytail",
+      "cli": null,
+      "checkout": "providers/skills/ponytail"
+    },
+    {
+      "id": "caveman",
+      "role": "output-compression",
+      "install": "git clone --depth 1 https://github.com/JuliusBrussee/caveman.git providers/skills/caveman",
+      "cli": null,
+      "checkout": "providers/skills/caveman"
+    },
+    {
+      "id": "context-mode",
+      "role": "tool-context-control",
+      "install": "npm install -g context-mode",
+      "cli": null,
+      "checkout": null
+    },
+    {
+      "id": "open-code-review",
+      "role": "code-review",
+      "install": "npm install -g @alibaba-group/open-code-review",
+      "cli": "ocr",
+      "checkout": null
+    },
+    {
+      "id": "owasp-scp",
+      "role": "security-knowledge",
+      "install": "git clone --depth 1 https://github.com/OWASP/secure-coding-practices-quick-reference-guide.git providers/refs/owasp-scp",
+      "cli": null,
+      "checkout": "providers/refs/owasp-scp"
+    },
+    {
+      "id": "owasp-top10",
+      "role": "security-knowledge",
+      "install": "git clone --depth 1 https://github.com/OWASP/Top10.git providers/refs/owasp-top10",
+      "cli": null,
+      "checkout": "providers/refs/owasp-top10"
+    },
+    {
+      "id": "semgrep",
+      "role": "fast-security",
+      "install": "pip install semgrep",
+      "cli": "semgrep",
+      "checkout": null
+    },
+    {
+      "id": "codeql",
+      "role": "deep-security",
+      "install": "manual ÔÇö install CodeQL CLI if needed",
+      "cli": "codeql",
+      "checkout": null
+    },
+    {
+      "id": "bearer",
+      "role": "dataflow-security",
+      "install": "manual ÔÇö install Bearer CLI if needed",
+      "cli": "bearer",
+      "checkout": null
+    },
+    {
+      "id": "prettier",
+      "role": "formatting",
+      "install": "detect in target project",
+      "cli": "prettier",
+      "checkout": null
+    },
+    {
+      "id": "eslint",
+      "role": "js-quality",
+      "install": "detect in target project",
+      "cli": "eslint",
+      "checkout": null
+    },
+    {
+      "id": "biome",
+      "role": "format-lint-unified",
+      "install": "detect in target project",
+      "cli": "biome",
+      "checkout": null
+    }
+  ]
+}
diff --git a/src/core/paths.ts b/src/core/paths.ts
index 0805291..bd6d28b 100644
--- a/src/core/paths.ts
+++ b/src/core/paths.ts
@@ -39,8 +39,24 @@ export function decisionsPath(config: SystemConfig, projectId: string): string {
 
 export function constraintsPath(config: SystemConfig, projectId: string): string {
   return join(contextDir(config, projectId), "CONSTRAINTS.md");
 }
 
 export function architecturePath(config: SystemConfig, projectId: string): string {
   return join(contextDir(config, projectId), "ARCHITECTURE.md");
 }
+
+export function providersDir(config: SystemConfig): string {
+  return join(config.systemRoot, "providers");
+}
+
+export function reviewsDir(config: SystemConfig, projectId: string): string {
+  return join(projectDir(config, projectId), "reviews");
+}
+
+export function tempSessionDir(
+  config: SystemConfig,
+  projectId: string,
+  sessionId: string,
+): string {
+  return join(projectDir(config, projectId), "temp", sessionId);
+}
diff --git a/src/providers/registry.ts b/src/providers/registry.ts
new file mode 100644
index 0000000..c1d48a3
--- /dev/null
+++ b/src/providers/registry.ts
@@ -0,0 +1,17 @@
+import { readFileSync, existsSync } from "node:fs";
+import { join } from "node:path";
+import type { SystemConfig } from "../core/config.js";
+import { providersDir } from "../core/paths.js";
+import type { ProviderRegistry } from "./types.js";
+
+export function providerRegistryPath(config: SystemConfig): string {
+  return join(providersDir(config), "registry.json");
+}
+
+export function loadProviderRegistry(config: SystemConfig): ProviderRegistry {
+  const path = providerRegistryPath(config);
+  if (!existsSync(path)) {
+    throw new Error(`Provider registry not found: ${path}`);
+  }
+  return JSON.parse(readFileSync(path, "utf8")) as ProviderRegistry;
+}
diff --git a/src/providers/types.ts b/src/providers/types.ts
new file mode 100644
index 0000000..c5b87da
--- /dev/null
+++ b/src/providers/types.ts
@@ -0,0 +1,26 @@
+export type ProviderRole =
+  | "code-structure"
+  | "historical-memory"
+  | "implementation-discipline"
+  | "output-compression"
+  | "tool-context-control"
+  | "code-review"
+  | "security-knowledge"
+  | "fast-security"
+  | "deep-security"
+  | "dataflow-security"
+  | "formatting"
+  | "js-quality"
+  | "format-lint-unified";
+
+export interface ProviderEntry {
+  id: string;
+  role: ProviderRole;
+  install: string;
+  cli: string | null;
+  checkout: string | null;
+}
+
+export interface ProviderRegistry {
+  providers: ProviderEntry[];
+}
diff --git a/src/providers/which.ts b/src/providers/which.ts
new file mode 100644
index 0000000..82e6868
--- /dev/null
+++ b/src/providers/which.ts
@@ -0,0 +1,15 @@
+import { spawnSync } from "node:child_process";
+
+export function cliAvailable(cmd: string): boolean {
+  const help = spawnSync(cmd, ["--help"], {
+    encoding: "utf8",
+    windowsHide: true,
+  });
+  if (help.status === 0) return true;
+
+  const where = spawnSync("where.exe", [cmd], {
+    encoding: "utf8",
+    windowsHide: true,
+  });
+  return where.status === 0;
+}
diff --git a/tests/provider-registry.test.ts b/tests/provider-registry.test.ts
new file mode 100644
index 0000000..f371c34
--- /dev/null
+++ b/tests/provider-registry.test.ts
@@ -0,0 +1,49 @@
+import { describe, it, expect } from "vitest";
+import { loadConfig } from "../src/core/config.js";
+import {
+  providersDir,
+  reviewsDir,
+  tempSessionDir,
+} from "../src/core/paths.js";
+import { loadProviderRegistry } from "../src/providers/registry.js";
+import { cliAvailable } from "../src/providers/which.js";
+
+const EXPECTED_IDS = [
+  "graphify",
+  "claude-mem",
+  "ponytail",
+  "caveman",
+  "context-mode",
+  "open-code-review",
+  "owasp-scp",
+  "owasp-top10",
+  "semgrep",
+  "codeql",
+  "bearer",
+  "prettier",
+  "eslint",
+  "biome",
+] as const;
+
+describe("provider registry", () => {
+  it("loads registry and lists all provider ids", () => {
+    const config = loadConfig();
+    const registry = loadProviderRegistry(config);
+    const ids = registry.providers.map((p) => p.id);
+    expect(ids).toEqual([...EXPECTED_IDS]);
+  });
+
+  it("exposes provider path helpers", () => {
+    const config = loadConfig();
+    expect(providersDir(config)).toMatch(/providers$/);
+    expect(reviewsDir(config, "abc123")).toMatch(/projects[/\\]abc123[/\\]reviews$/);
+    expect(tempSessionDir(config, "abc123", "sess-1")).toMatch(
+      /projects[/\\]abc123[/\\]temp[/\\]sess-1$/,
+    );
+  });
+
+  it("checks cli availability without throwing", () => {
+    const available = cliAvailable("node");
+    expect(typeof available).toBe("boolean");
+  });
+});
