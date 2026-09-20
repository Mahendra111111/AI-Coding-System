# Review package Task 1
BASE: 753e16c04f8e3e1336228709059878d7977b638f
HEAD: 59a1da1ac49c6066447710de4de75d08cf0c2021

## Commits
59a1da1 feat: extend system config with provider toggles

## Stat
 config/system.json             | 33 +++++++++++++++++++++++++++++++
 src/core/config.ts             | 45 +++++++++++++++++++++++++++++++++++++++++-
 tests/config-providers.test.ts | 19 ++++++++++++++++++
 3 files changed, 96 insertions(+), 1 deletion(-)

## Diff
diff --git a/config/system.json b/config/system.json
index 69c9de1..c65c1ab 100644
--- a/config/system.json
+++ b/config/system.json
@@ -1,14 +1,47 @@
 {
   "systemRoot": "C:\\AI-Coding-System",
   "projectRoots": ["D:\\"],
   "identity": {
     "hashLength": 20
   },
   "graphify": {
     "enabled": true,
     "preferCodeOnly": true
   },
+  "memory": {
+    "enabled": true,
+    "provider": "claude-mem"
+  },
+  "ponytail": {
+    "enabled": true
+  },
+  "caveman": {
+    "enabled": false
+  },
+  "contextMode": {
+    "enabled": true
+  },
+  "review": {
+    "openCodeReview": {
+      "enabled": true
+    }
+  },
+  "security": {
+    "semgrep": {
+      "enabled": true
+    },
+    "codeql": {
+      "enabled": false
+    },
+    "bearer": {
+      "enabled": false
+    },
+    "defaultPolicy": "light"
+  },
+  "validation": {
+    "maxBuildAttempts": 3
+  },
   "telemetry": {
     "enabled": false
   }
 }
diff --git a/src/core/config.ts b/src/core/config.ts
index 7756f3d..9060187 100644
--- a/src/core/config.ts
+++ b/src/core/config.ts
@@ -1,44 +1,87 @@
 import { readFileSync, existsSync } from "node:fs";
 import { dirname, join } from "node:path";
 import { fileURLToPath } from "node:url";
 
+export type SecurityPolicy = "light" | "normal" | "deep";
+
 export interface SystemConfig {
   systemRoot: string;
   projectRoots: string[];
   identity: { hashLength: number };
   graphify: { enabled: boolean; preferCodeOnly: boolean };
+  memory: { enabled: boolean; provider: "claude-mem" };
+  ponytail: { enabled: boolean };
+  caveman: { enabled: boolean };
+  contextMode: { enabled: boolean };
+  review: { openCodeReview: { enabled: boolean } };
+  security: {
+    semgrep: { enabled: boolean };
+    codeql: { enabled: boolean };
+    bearer: { enabled: boolean };
+    defaultPolicy: SecurityPolicy;
+  };
+  validation: { maxBuildAttempts: number };
   telemetry: { enabled: boolean };
 }
 
 const DEFAULT_CONFIG: SystemConfig = {
   systemRoot: "C:\\AI-Coding-System",
   projectRoots: ["D:\\"],
   identity: { hashLength: 20 },
   graphify: { enabled: true, preferCodeOnly: true },
+  memory: { enabled: true, provider: "claude-mem" },
+  ponytail: { enabled: true },
+  caveman: { enabled: false },
+  contextMode: { enabled: true },
+  review: { openCodeReview: { enabled: true } },
+  security: {
+    semgrep: { enabled: true },
+    codeql: { enabled: false },
+    bearer: { enabled: false },
+    defaultPolicy: "light",
+  },
+  validation: { maxBuildAttempts: 3 },
   telemetry: { enabled: false },
 };
 
 function resolveSystemRoot(): string {
   const fromEnv = process.env.AI_CODING_SYSTEM_ROOT;
   if (fromEnv) return fromEnv;
   const here = dirname(fileURLToPath(import.meta.url));
-  // src/core -> repo root (dev) or dist/core -> repo root (built)
   return join(here, "..", "..");
 }
 
 export function loadConfig(): SystemConfig {
   const root = resolveSystemRoot();
   const configPath = join(root, "config", "system.json");
   if (!existsSync(configPath)) {
     return { ...DEFAULT_CONFIG, systemRoot: root };
   }
   const raw = JSON.parse(readFileSync(configPath, "utf8")) as Partial<SystemConfig>;
   return {
     ...DEFAULT_CONFIG,
     ...raw,
     systemRoot: raw.systemRoot ?? root,
     identity: { ...DEFAULT_CONFIG.identity, ...raw.identity },
     graphify: { ...DEFAULT_CONFIG.graphify, ...raw.graphify },
+    memory: { ...DEFAULT_CONFIG.memory, ...raw.memory },
+    ponytail: { ...DEFAULT_CONFIG.ponytail, ...raw.ponytail },
+    caveman: { ...DEFAULT_CONFIG.caveman, ...raw.caveman },
+    contextMode: { ...DEFAULT_CONFIG.contextMode, ...raw.contextMode },
+    review: {
+      openCodeReview: {
+        ...DEFAULT_CONFIG.review.openCodeReview,
+        ...raw.review?.openCodeReview,
+      },
+    },
+    security: {
+      ...DEFAULT_CONFIG.security,
+      ...raw.security,
+      semgrep: { ...DEFAULT_CONFIG.security.semgrep, ...raw.security?.semgrep },
+      codeql: { ...DEFAULT_CONFIG.security.codeql, ...raw.security?.codeql },
+      bearer: { ...DEFAULT_CONFIG.security.bearer, ...raw.security?.bearer },
+    },
+    validation: { ...DEFAULT_CONFIG.validation, ...raw.validation },
     telemetry: { ...DEFAULT_CONFIG.telemetry, ...raw.telemetry },
   };
 }
diff --git a/tests/config-providers.test.ts b/tests/config-providers.test.ts
new file mode 100644
index 0000000..add1b68
--- /dev/null
+++ b/tests/config-providers.test.ts
@@ -0,0 +1,19 @@
+import { describe, it, expect } from "vitest";
+import { loadConfig } from "../src/core/config.js";
+
+describe("provider config", () => {
+  it("loads memory, contextMode, caveman, review, security, validation defaults", () => {
+    const config = loadConfig();
+    expect(config.memory.enabled).toBe(true);
+    expect(config.memory.provider).toBe("claude-mem");
+    expect(config.contextMode.enabled).toBe(true);
+    expect(config.caveman.enabled).toBe(false);
+    expect(config.ponytail.enabled).toBe(true);
+    expect(config.review.openCodeReview.enabled).toBe(true);
+    expect(config.security.semgrep.enabled).toBe(true);
+    expect(config.security.codeql.enabled).toBe(false);
+    expect(config.security.bearer.enabled).toBe(false);
+    expect(config.security.defaultPolicy).toBe("light");
+    expect(config.validation.maxBuildAttempts).toBe(3);
+  });
+});

