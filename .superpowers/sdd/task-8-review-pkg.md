# T8
BASE: e786efe261acf13edab565f4f9b7be74bb75c652
HEAD: b9c096e6e514a255557711533098f49f621fac9b
## Commits
b9c096e feat: quality detect and check for prettier eslint biome
## Stat
 .superpowers/sdd/task-8-report.md |  29 ++++
 src/mcp/tools.ts                  |  23 +++
 src/providers/quality.ts          | 292 ++++++++++++++++++++++++++++++++++++++
 tests/quality-detect.test.ts      | 139 ++++++++++++++++++
 4 files changed, 483 insertions(+)
## Diff
diff --git a/.superpowers/sdd/task-8-report.md b/.superpowers/sdd/task-8-report.md
new file mode 100644
index 0000000..e9b05ce
--- /dev/null
+++ b/.superpowers/sdd/task-8-report.md
@@ -0,0 +1,29 @@
+# Task 8 Report: Quality detect/check
+
+## Status
+**COMPLETE** ÔÇö TDD REDÔåÆGREEN, committed.
+
+## Commit
+- `<hash>` ÔÇö `feat: quality detect and check for prettier eslint biome`
+
+## Files Created / Modified
+| File | Purpose |
+|------|---------|
+| `src/providers/quality.ts` | `detectQualityStack`, `runQualityCheck` (4k truncate, conflict skip) |
+| `src/mcp/tools.ts` | MCP tools `quality_detect`, `quality_check` |
+| `tests/quality-detect.test.ts` | 9 tests with temp fixture dirs |
+
+## Test Summary
+```
+tests/quality-detect.test.ts  9 passed (9)
+Full suite                   33 passed (33)
+npm run build                OK
+```
+
+## Implementation Notes
+- Detects `biome.json`, `.prettierrc*`, `eslint.config.*`, `package.json` deps/scripts
+- Conflict when Prettier+Biome or ESLint+Biome; `runQualityCheck` skips auto-run on conflict
+- Biome-only runs `biome check`; Prettier+ESLint runs both via `npx`
+
+## Next Steps (Task 9+)
+- OpenCodeReview adapter (`review_diff`, `review_scan`)
diff --git a/src/mcp/tools.ts b/src/mcp/tools.ts
index acb65dc..f4ce0bb 100644
--- a/src/mcp/tools.ts
+++ b/src/mcp/tools.ts
@@ -22,8 +22,12 @@ import {
 } from "../project/state.js";
 import { getCavemanGuidance } from "../providers/caveman.js";
 import { securityRefs } from "../providers/owasp.js";
 import { getDisciplineRules } from "../providers/ponytail.js";
+import {
+  detectQualityStack,
+  runQualityCheck,
+} from "../providers/quality.js";
 import { getAllProviderStatuses } from "../providers/status.js";
 
 function textResult(text: string) {
   return { content: [{ type: "text" as const, text }] };
@@ -236,8 +240,27 @@ export function createServer(): McpServer {
     {},
     async () => textResult(getCavemanGuidance(config)),
   );
 
+  server.tool(
+    "quality_detect",
+    "Detect Prettier, ESLint, and Biome configuration in a workspace. Reports formatter/linter and conflicts.",
+    {
+      workspacePath: z.string().describe("Absolute workspace path"),
+    },
+    async ({ workspacePath }) =>
+      textResult(JSON.stringify(detectQualityStack(workspacePath), null, 2)),
+  );
+
+  server.tool(
+    "quality_check",
+    "Run non-conflicting quality tools detected in the workspace (Prettier/ESLint/Biome). Output truncated to 4k chars.",
+    {
+      workspacePath: z.string().describe("Absolute workspace path"),
+    },
+    async ({ workspacePath }) => textResult(runQualityCheck(workspacePath)),
+  );
+
   server.tool(
     "security_refs",
     "Return compact OWASP secure-coding excerpts for a topic (input-validation, auth, session, crypto, injection, access-control, config, general).",
     {
diff --git a/src/providers/quality.ts b/src/providers/quality.ts
new file mode 100644
index 0000000..9cfe711
--- /dev/null
+++ b/src/providers/quality.ts
@@ -0,0 +1,292 @@
+import { execFileSync } from "node:child_process";
+import { existsSync, readdirSync, readFileSync } from "node:fs";
+import { join } from "node:path";
+
+const MAX_OUTPUT_CHARS = 4000;
+
+export type Formatter = "prettier" | "biome" | "none";
+export type Linter = "eslint" | "biome" | "none";
+
+export interface QualityStack {
+  formatter: Formatter;
+  linter: Linter;
+  conflict: boolean;
+  detail: string;
+}
+
+interface PackageIndicators {
+  prettier: boolean;
+  eslint: boolean;
+  biome: boolean;
+}
+
+function truncate(text: string, max = MAX_OUTPUT_CHARS): string {
+  if (text.length <= max) return text;
+  return `${text.slice(0, max - 1)}ÔÇª`;
+}
+
+function listFiles(workspacePath: string): string[] {
+  try {
+    return readdirSync(workspacePath, { withFileTypes: true })
+      .filter((entry) => entry.isFile())
+      .map((entry) => entry.name);
+  } catch {
+    return [];
+  }
+}
+
+function readPackageJson(workspacePath: string): Record<string, unknown> | null {
+  const packagePath = join(workspacePath, "package.json");
+  if (!existsSync(packagePath)) return null;
+  try {
+    return JSON.parse(readFileSync(packagePath, "utf8")) as Record<
+      string,
+      unknown
+    >;
+  } catch {
+    return null;
+  }
+}
+
+function depsContain(
+  deps: unknown,
+  packageName: string,
+): boolean {
+  if (!deps || typeof deps !== "object") return false;
+  return Object.keys(deps as Record<string, unknown>).some(
+    (name) => name === packageName || name.includes(packageName),
+  );
+}
+
+function scriptsMention(
+  scripts: unknown,
+  tool: "prettier" | "eslint" | "biome",
+): boolean {
+  if (!scripts || typeof scripts !== "object") return false;
+  return Object.values(scripts as Record<string, unknown>).some((value) => {
+    if (typeof value !== "string") return false;
+    const normalized = value.toLowerCase();
+    switch (tool) {
+      case "prettier":
+        return normalized.includes("prettier");
+      case "eslint":
+        return normalized.includes("eslint");
+      case "biome":
+        return normalized.includes("biome");
+      default: {
+        const _exhaustive: never = tool;
+        return _exhaustive;
+      }
+    }
+  });
+}
+
+function packageIndicators(workspacePath: string): PackageIndicators {
+  const pkg = readPackageJson(workspacePath);
+  if (!pkg) {
+    return { prettier: false, eslint: false, biome: false };
+  }
+
+  const depSections = [
+    pkg.dependencies,
+    pkg.devDependencies,
+    pkg.peerDependencies,
+    pkg.optionalDependencies,
+  ];
+
+  const prettier =
+    depSections.some((deps) => depsContain(deps, "prettier")) ||
+    scriptsMention(pkg.scripts, "prettier");
+  const eslint =
+    depSections.some((deps) => depsContain(deps, "eslint")) ||
+    scriptsMention(pkg.scripts, "eslint");
+  const biome =
+    depSections.some((deps) => depsContain(deps, "@biomejs/biome")) ||
+    depSections.some((deps) => depsContain(deps, "biome")) ||
+    scriptsMention(pkg.scripts, "biome");
+
+  return { prettier, eslint, biome };
+}
+
+function hasPrettierConfig(workspacePath: string): boolean {
+  const files = listFiles(workspacePath);
+  if (files.some((name) => name.startsWith(".prettierrc"))) return true;
+  if (
+    files.some((name) =>
+      /^prettier\.config\.(js|cjs|mjs|ts)$/i.test(name),
+    )
+  ) {
+    return true;
+  }
+  return packageIndicators(workspacePath).prettier;
+}
+
+function hasEslintConfig(workspacePath: string): boolean {
+  const files = listFiles(workspacePath);
+  if (files.some((name) => /^eslint\.config\.(js|cjs|mjs|ts)$/i.test(name))) {
+    return true;
+  }
+  return packageIndicators(workspacePath).eslint;
+}
+
+function hasBiomeConfig(workspacePath: string): boolean {
+  if (
+    existsSync(join(workspacePath, "biome.json")) ||
+    existsSync(join(workspacePath, "biome.jsonc"))
+  ) {
+    return true;
+  }
+  return packageIndicators(workspacePath).biome;
+}
+
+export function detectQualityStack(workspacePath: string): QualityStack {
+  const prettier = hasPrettierConfig(workspacePath);
+  const eslint = hasEslintConfig(workspacePath);
+  const biome = hasBiomeConfig(workspacePath);
+
+  const prettierBiomeConflict = prettier && biome;
+  const eslintBiomeConflict = eslint && biome;
+  const conflict = prettierBiomeConflict || eslintBiomeConflict;
+
+  let formatter: Formatter = "none";
+  let linter: Linter = "none";
+
+  if (biome && !prettier) {
+    formatter = "biome";
+  } else if (prettier) {
+    formatter = "prettier";
+  }
+
+  if (biome && !eslint) {
+    linter = "biome";
+  } else if (eslint) {
+    linter = "eslint";
+  }
+
+  const parts: string[] = [];
+  if (prettier) parts.push("Prettier configured");
+  if (eslint) parts.push("ESLint configured");
+  if (biome) parts.push("Biome configured");
+
+  if (parts.length === 0) {
+    return {
+      formatter: "none",
+      linter: "none",
+      conflict: false,
+      detail: "No quality tools detected (checked biome.json, .prettierrc*, eslint.config.*, package.json).",
+    };
+  }
+
+  if (conflict) {
+    const conflicts: string[] = [];
+    if (prettierBiomeConflict) conflicts.push("Prettier + Biome");
+    if (eslintBiomeConflict) conflicts.push("ESLint + Biome");
+    return {
+      formatter,
+      linter,
+      conflict: true,
+      detail: `${parts.join("; ")}. Conflict: ${conflicts.join(" and ")} ÔÇö choose one toolchain.`,
+    };
+  }
+
+  return {
+    formatter,
+    linter,
+    conflict: false,
+    detail: parts.join("; "),
+  };
+}
+
+function runCommand(
+  label: string,
+  command: string,
+  args: string[],
+  cwd: string,
+): string {
+  try {
+    const stdout = execFileSync(command, args, {
+      cwd,
+      encoding: "utf8",
+      stdio: ["ignore", "pipe", "pipe"],
+      windowsHide: true,
+      timeout: 120_000,
+    });
+    return `=== ${label} ===\n${stdout.trim() || "(no output)"}`;
+  } catch (err) {
+    const execErr = err as {
+      stdout?: string;
+      stderr?: string;
+      message?: string;
+    };
+    const stdout = execErr.stdout?.trim() ?? "";
+    const stderr = execErr.stderr?.trim() ?? "";
+    const body = [stdout, stderr].filter(Boolean).join("\n");
+    return `=== ${label} ===\n${body || execErr.message || "command failed"}`;
+  }
+}
+
+export function runQualityCheck(workspacePath: string): string {
+  const stack = detectQualityStack(workspacePath);
+
+  if (stack.conflict) {
+    return truncate(
+      `Quality tool conflict detected.\n${stack.detail}\nSkipped auto-run; resolve the conflict first.`,
+    );
+  }
+
+  if (stack.formatter === "none" && stack.linter === "none") {
+    return truncate(
+      "No quality tools configured. Checked biome.json, .prettierrc*, eslint.config.*, and package.json deps/scripts.",
+    );
+  }
+
+  const sections: string[] = [`Detected: ${stack.detail}`];
+
+  if (stack.formatter === "biome" && stack.linter === "biome") {
+    sections.push(
+      runCommand(
+        "biome check",
+        "npx",
+        ["--no", "@biomejs/biome", "check", "."],
+        workspacePath,
+      ),
+    );
+  } else {
+    if (stack.formatter === "prettier") {
+      sections.push(
+        runCommand(
+          "prettier --check",
+          "npx",
+          ["--no", "prettier", "--check", "."],
+          workspacePath,
+        ),
+      );
+    } else if (stack.formatter === "biome") {
+      sections.push(
+        runCommand(
+          "biome format",
+          "npx",
+          ["--no", "@biomejs/biome", "format", "--write=false", "."],
+          workspacePath,
+        ),
+      );
+    }
+
+    if (stack.linter === "eslint") {
+      sections.push(
+        runCommand("eslint", "npx", ["--no", "eslint", "."], workspacePath),
+      );
+    } else if (stack.linter === "biome") {
+      sections.push(
+        runCommand(
+          "biome lint",
+          "npx",
+          ["--no", "@biomejs/biome", "lint", "."],
+          workspacePath,
+        ),
+      );
+    }
+  }
+
+  return truncate(sections.join("\n\n"));
+}
diff --git a/tests/quality-detect.test.ts b/tests/quality-detect.test.ts
new file mode 100644
index 0000000..91d967f
--- /dev/null
+++ b/tests/quality-detect.test.ts
@@ -0,0 +1,139 @@
+import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
+import { join } from "node:path";
+import { tmpdir } from "node:os";
+import { describe, expect, it } from "vitest";
+import {
+  detectQualityStack,
+  runQualityCheck,
+} from "../src/providers/quality.js";
+
+function fixture(name: string, files: Record<string, string>): string {
+  const root = mkdtempSync(join(tmpdir(), `acs-quality-${name}-`));
+  for (const [rel, content] of Object.entries(files)) {
+    const target = join(root, rel);
+    mkdirSync(join(target, ".."), { recursive: true });
+    writeFileSync(target, content);
+  }
+  return root;
+}
+
+describe("detectQualityStack", () => {
+  it("returns none when no quality tooling is configured", () => {
+    const root = fixture("empty", {});
+    const stack = detectQualityStack(root);
+
+    expect(stack.formatter).toBe("none");
+    expect(stack.linter).toBe("none");
+    expect(stack.conflict).toBe(false);
+    expect(stack.detail.toLowerCase()).toContain("no quality");
+  });
+
+  it("detects biome-only stack from biome.json", () => {
+    const root = fixture("biome-only", {
+      "biome.json": '{"linter":{"enabled":true}}',
+    });
+    const stack = detectQualityStack(root);
+
+    expect(stack.formatter).toBe("biome");
+    expect(stack.linter).toBe("biome");
+    expect(stack.conflict).toBe(false);
+    expect(stack.detail.toLowerCase()).toContain("biome");
+  });
+
+  it("detects prettier and eslint without conflict", () => {
+    const root = fixture("prettier-eslint", {
+      ".prettierrc": '{"singleQuote":true}',
+      "eslint.config.js": "export default [];",
+    });
+    const stack = detectQualityStack(root);
+
+    expect(stack.formatter).toBe("prettier");
+    expect(stack.linter).toBe("eslint");
+    expect(stack.conflict).toBe(false);
+  });
+
+  it("flags prettier and biome as conflicting", () => {
+    const root = fixture("prettier-biome", {
+      ".prettierrc.json": "{}",
+      "biome.json": "{}",
+    });
+    const stack = detectQualityStack(root);
+
+    expect(stack.conflict).toBe(true);
+    expect(stack.detail.toLowerCase()).toMatch(/prettier.*biome|biome.*prettier/);
+  });
+
+  it("flags eslint and biome as conflicting", () => {
+    const root = fixture("eslint-biome", {
+      "eslint.config.mjs": "export default [];",
+      "biome.json": "{}",
+    });
+    const stack = detectQualityStack(root);
+
+    expect(stack.conflict).toBe(true);
+    expect(stack.detail.toLowerCase()).toMatch(/eslint.*biome|biome.*eslint/);
+  });
+
+  it("detects tooling from package.json deps and scripts", () => {
+    const root = fixture("package-json", {
+      "package.json": JSON.stringify(
+        {
+          devDependencies: {
+            prettier: "^3.0.0",
+            eslint: "^9.0.0",
+          },
+          scripts: {
+            format: "prettier --check .",
+            lint: "eslint .",
+          },
+        },
+        null,
+        2,
+      ),
+    });
+    const stack = detectQualityStack(root);
+
+    expect(stack.formatter).toBe("prettier");
+    expect(stack.linter).toBe("eslint");
+    expect(stack.conflict).toBe(false);
+  });
+
+  it("detects biome from package.json dependency", () => {
+    const root = fixture("biome-dep", {
+      "package.json": JSON.stringify({
+        devDependencies: {
+          "@biomejs/biome": "^1.9.0",
+        },
+        scripts: {
+          check: "biome check .",
+        },
+      }),
+    });
+    const stack = detectQualityStack(root);
+
+    expect(stack.formatter).toBe("biome");
+    expect(stack.linter).toBe("biome");
+    expect(stack.conflict).toBe(false);
+  });
+});
+
+describe("runQualityCheck", () => {
+  it("reports conflict without running competing tools", () => {
+    const root = fixture("run-conflict", {
+      ".prettierrc": "{}",
+      "biome.json": "{}",
+    });
+    const output = runQualityCheck(root);
+
+    expect(output.toLowerCase()).toContain("conflict");
+    expect(output.length).toBeLessThanOrEqual(4000);
+  });
+
+  it("reports when no tools are configured", () => {
+    const root = fixture("run-empty", {});
+    const output = runQualityCheck(root);
+
+    expect(output.toLowerCase()).toMatch(/no quality|not configured/);
+    expect(output.length).toBeLessThanOrEqual(4000);
+  });
+});
