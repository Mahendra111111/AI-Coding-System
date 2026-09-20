# T11
BASE: f67ad5e3769d4e239f86e3118e4f039c44bba752
HEAD: 684afceda84c4b3ef028d9d2c24004146f757e1a
## Commits
684afce feat: security scan orchestrator (semgrep-first)
## Stat
 src/mcp/tools.ts            |  12 +++
 src/security/scan.ts        | 189 ++++++++++++++++++++++++++++++++++++++++++++
 tests/security-scan.test.ts | 137 ++++++++++++++++++++++++++++++++
 3 files changed, 338 insertions(+)
## Diff
diff --git a/src/mcp/tools.ts b/src/mcp/tools.ts
index f20b564..cece9e4 100644
--- a/src/mcp/tools.ts
+++ b/src/mcp/tools.ts
@@ -29,8 +29,9 @@ import {
   detectQualityStack,
   runQualityCheck,
 } from "../providers/quality.js";
 import { getAllProviderStatuses } from "../providers/status.js";
+import { runSecurityScan } from "../security/scan.js";
 
 function textResult(text: string) {
   return { content: [{ type: "text" as const, text }] };
 }
@@ -340,8 +341,19 @@ export function createServer(): McpServer {
     async ({ topic, maxChars }) =>
       textResult(securityRefs(config, topic, maxChars ?? 2000)),
   );
 
+  server.tool(
+    "security_scan",
+    "Run the configured security scanners by policy. Light runs Semgrep; normal adds review guidance; deep also runs enabled CodeQL and Bearer. Findings are capped at 3k characters.",
+    {
+      workspacePath: z.string().describe("Absolute workspace path"),
+      policy: z.enum(["light", "normal", "deep"]).optional(),
+    },
+    async ({ workspacePath, policy }) =>
+      textResult(runSecurityScan(config, { workspacePath, policy })),
+  );
+
   if (config.graphify.enabled) {
     server.tool(
       "graph_query",
       "Query Graphify knowledge graph for the workspace (optional; requires graphify CLI).",
diff --git a/src/security/scan.ts b/src/security/scan.ts
new file mode 100644
index 0000000..cdd18f0
--- /dev/null
+++ b/src/security/scan.ts
@@ -0,0 +1,189 @@
+import { execFileSync } from "node:child_process";
+import type { SecurityPolicy, SystemConfig } from "../core/config.js";
+import { cliAvailable } from "../providers/which.js";
+
+const MAX_FINDINGS_CHARS = 3000;
+
+export interface SecurityScanOptions {
+  workspacePath: string;
+  policy?: SecurityPolicy;
+}
+
+interface CommandError {
+  stdout?: string;
+  stderr?: string;
+  message?: string;
+}
+
+function truncate(text: string): string {
+  if (text.length <= MAX_FINDINGS_CHARS) return text;
+  return `${text.slice(0, MAX_FINDINGS_CHARS - 1)}ÔÇª`;
+}
+
+function compactJson(output: string): string {
+  try {
+    const parsed = JSON.parse(output) as {
+      results?: Array<{
+        check_id?: string;
+        path?: string;
+        start?: { line?: number };
+        extra?: {
+          message?: string;
+          severity?: string;
+        };
+        rule?: { id?: string };
+        filename?: string;
+        line_number?: number;
+        title?: string;
+        description?: string;
+        severity?: string;
+      }>;
+      findings?: Array<Record<string, unknown>>;
+    };
+    const findings = parsed.results ?? parsed.findings;
+    if (!Array.isArray(findings)) {
+      return "Scan completed; structured output contained no findings list.";
+    }
+    if (findings.length === 0) return "No findings.";
+
+    return findings
+      .map((finding, index) => {
+        const semgrep = finding as NonNullable<typeof parsed.results>[number];
+        const location = semgrep.path ?? semgrep.filename ?? "unknown";
+        const line = semgrep.start?.line ?? semgrep.line_number;
+        const rule = semgrep.check_id ?? semgrep.rule?.id ?? semgrep.title;
+        const message = semgrep.extra?.message ?? semgrep.description;
+        const severity = semgrep.extra?.severity ?? semgrep.severity;
+        return [
+          `${index + 1}. ${location}${line ? `:${line}` : ""}`,
+          rule ? `[${rule}]` : "",
+          severity ? `(${severity})` : "",
+          message ?? "Finding reported",
+        ]
+          .filter(Boolean)
+          .join(" ");
+      })
+      .join("\n");
+  } catch {
+    return output.trim() || "Scan completed with no output.";
+  }
+}
+
+function runTool(
+  label: string,
+  command: string,
+  args: string[],
+  workspacePath: string,
+  structuredJson: boolean,
+): string {
+  try {
+    const output = execFileSync(command, args, {
+      cwd: workspacePath,
+      encoding: "utf8",
+      stdio: ["ignore", "pipe", "pipe"],
+      windowsHide: true,
+      timeout: 300_000,
+    }).trim();
+    const findings = structuredJson ? compactJson(output) : output || "No findings.";
+    return `=== ${label} ===\n${findings}`;
+  } catch (error) {
+    const executionError = error as CommandError;
+    const output = [executionError.stdout, executionError.stderr]
+      .filter(Boolean)
+      .join("\n")
+      .trim();
+    const findings = structuredJson ? compactJson(output) : output;
+    return `=== ${label} ===\n${findings || executionError.message || "Scan failed."}`;
+  }
+}
+
+function semgrepSection(config: SystemConfig, workspacePath: string): string {
+  if (!config.security.semgrep.enabled) {
+    return "=== Semgrep ===\nSkipped: disabled in configuration.";
+  }
+  if (!cliAvailable("semgrep")) {
+    return "=== Semgrep ===\nSkipped: CLI unavailable.";
+  }
+  return runTool(
+    "Semgrep",
+    "semgrep",
+    ["scan", "--config", "auto", "--json", "."],
+    workspacePath,
+    true,
+  );
+}
+
+function reviewNote(): string {
+  return "=== Review ===\nRun review_diff or review_scan for human-oriented security review.";
+}
+
+function deepSections(config: SystemConfig, workspacePath: string): string[] {
+  const sections: string[] = [];
+
+  if (!config.security.codeql.enabled) {
+    sections.push("=== CodeQL ===\nSkipped: disabled in configuration.");
+  } else if (!cliAvailable("codeql")) {
+    sections.push("=== CodeQL ===\nSkipped: CLI unavailable.");
+  } else {
+    sections.push(
+      runTool(
+        "CodeQL",
+        "codeql",
+        ["database", "analyze", ".", "--format=csv", "--output=-"],
+        workspacePath,
+        false,
+      ),
+    );
+  }
+
+  if (!config.security.bearer.enabled) {
+    sections.push("=== Bearer ===\nSkipped: disabled in configuration.");
+  } else if (!cliAvailable("bearer")) {
+    sections.push("=== Bearer ===\nSkipped: CLI unavailable.");
+  } else {
+    sections.push(
+      runTool(
+        "Bearer",
+        "bearer",
+        ["scan", ".", "--format", "json"],
+        workspacePath,
+        true,
+      ),
+    );
+  }
+
+  return sections;
+}
+
+export function runSecurityScan(
+  config: SystemConfig,
+  options: SecurityScanOptions,
+): string {
+  const policy = options.policy ?? config.security.defaultPolicy;
+  const sections = [`Security policy: ${policy}`];
+
+  switch (policy) {
+    case "light":
+      sections.push(semgrepSection(config, options.workspacePath));
+      break;
+    case "normal":
+      sections.push(
+        semgrepSection(config, options.workspacePath),
+        reviewNote(),
+      );
+      break;
+    case "deep":
+      sections.push(
+        semgrepSection(config, options.workspacePath),
+        reviewNote(),
+        ...deepSections(config, options.workspacePath),
+      );
+      break;
+    default: {
+      const _exhaustive: never = policy;
+      return _exhaustive;
+    }
+  }
+
+  return truncate(sections.join("\n\n"));
+}
diff --git a/tests/security-scan.test.ts b/tests/security-scan.test.ts
new file mode 100644
index 0000000..3a82549
--- /dev/null
+++ b/tests/security-scan.test.ts
@@ -0,0 +1,137 @@
+import { execFileSync } from "node:child_process";
+import { beforeEach, describe, expect, it, vi } from "vitest";
+import type { SystemConfig } from "../src/core/config.js";
+import { cliAvailable } from "../src/providers/which.js";
+import { runSecurityScan } from "../src/security/scan.js";
+
+vi.mock("../src/providers/which.js", () => ({
+  cliAvailable: vi.fn(() => true),
+}));
+
+vi.mock("node:child_process", () => ({
+  execFileSync: vi.fn((command: string) => {
+    if (command === "semgrep") {
+      return JSON.stringify({
+        results: [
+          {
+            check_id: "test.rule",
+            path: "src/app.ts",
+            start: { line: 7 },
+            extra: { message: "Unsafe input", severity: "ERROR" },
+          },
+        ],
+      });
+    }
+    if (command === "bearer") return JSON.stringify({ findings: [] });
+    if (command === "codeql") return "rule,path,line\n";
+    return "";
+  }),
+}));
+
+function config(
+  security: Partial<SystemConfig["security"]> = {},
+): SystemConfig {
+  return {
+    systemRoot: "C:\\AI-Coding-System",
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
+      ...security,
+    },
+    validation: { maxBuildAttempts: 3 },
+    telemetry: { enabled: false },
+  };
+}
+
+beforeEach(() => {
+  vi.clearAllMocks();
+  vi.mocked(cliAvailable).mockReturnValue(true);
+});
+
+describe("runSecurityScan", () => {
+  it("runs Semgrep first for light policy and summarizes JSON", () => {
+    const result = runSecurityScan(config(), {
+      workspacePath: "C:\\workspace",
+      policy: "light",
+    });
+
+    expect(execFileSync).toHaveBeenCalledWith(
+      "semgrep",
+      ["scan", "--config", "auto", "--json", "."],
+      expect.objectContaining({ cwd: "C:\\workspace" }),
+    );
+    expect(result).toContain("test.rule");
+    expect(result).toContain("src/app.ts:7");
+    expect(result).not.toContain('"results"');
+  });
+
+  it("uses the configured default and adds review guidance for normal", () => {
+    const result = runSecurityScan(config({ defaultPolicy: "normal" }), {
+      workspacePath: "C:\\workspace",
+    });
+
+    expect(result).toContain("Security policy: normal");
+    expect(result).toContain("review_diff or review_scan");
+  });
+
+  it("runs enabled and available deep scanners", () => {
+    const result = runSecurityScan(
+      config({
+        codeql: { enabled: true },
+        bearer: { enabled: true },
+        defaultPolicy: "deep",
+      }),
+      { workspacePath: "C:\\workspace" },
+    );
+
+    expect(execFileSync).toHaveBeenCalledWith(
+      "codeql",
+      ["database", "analyze", ".", "--format=csv", "--output=-"],
+      expect.any(Object),
+    );
+    expect(execFileSync).toHaveBeenCalledWith(
+      "bearer",
+      ["scan", ".", "--format", "json"],
+      expect.any(Object),
+    );
+    expect(result).toContain("=== CodeQL ===");
+    expect(result).toContain("=== Bearer ===");
+  });
+
+  it("reports skipped scanners when disabled or unavailable", () => {
+    vi.mocked(cliAvailable).mockReturnValue(false);
+
+    const result = runSecurityScan(
+      config({
+        codeql: { enabled: true },
+        bearer: { enabled: false },
+        defaultPolicy: "deep",
+      }),
+      { workspacePath: "C:\\workspace" },
+    );
+
+    expect(result).toContain("Skipped: CLI unavailable");
+    expect(result).toContain("Skipped: disabled");
+    expect(execFileSync).not.toHaveBeenCalled();
+  });
+
+  it("truncates all returned findings to 3000 characters", () => {
+    vi.mocked(execFileSync).mockReturnValue("x".repeat(5000));
+
+    const result = runSecurityScan(config(), {
+      workspacePath: "C:\\workspace",
+    });
+
+    expect(result.length).toBeLessThanOrEqual(3000);
+  });
+});
