# T7
BASE: adb605da753227a501ef4dba4e43fc50083e516a
HEAD: e786efe261acf13edab565f4f9b7be74bb75c652
## Commits
e786efe feat: task-scoped OWASP security refs tool
## Stat
 .superpowers/sdd/task-7-report.md |  42 ++++++
 src/mcp/tools.ts                  |  20 +++
 src/providers/owasp.ts            | 295 ++++++++++++++++++++++++++++++++++++++
 tests/owasp-refs.test.ts          | 117 +++++++++++++++
 4 files changed, 474 insertions(+)
## Diff
diff --git a/.superpowers/sdd/task-7-report.md b/.superpowers/sdd/task-7-report.md
new file mode 100644
index 0000000..5747ca9
--- /dev/null
+++ b/.superpowers/sdd/task-7-report.md
@@ -0,0 +1,42 @@
+# Task 7 Report: OWASP topic refs tool
+
+## Status
+**COMPLETE** ÔÇö TDD REDÔåÆGREEN, committed.
+
+## Commit
+- `8f98d65` ÔÇö `feat: task-scoped OWASP security refs tool`
+
+## Files Created / Modified
+| File | Purpose |
+|------|---------|
+| `src/providers/owasp.ts` | `securityRefs`: topic keyword search over `providers/refs/` with truncation + install hint |
+| `src/mcp/tools.ts` | MCP tool `security_refs` (topic, maxChars) |
+| `tests/owasp-refs.test.ts` | 5 tests: install hint, topic excerpts, injection match, truncation, unknown topic |
+
+## Test Summary
+```
+tests/owasp-refs.test.ts  5 passed (5)
+Full suite               24 passed (24)
+npm run build            OK
+```
+
+### Cases Covered
+1. **Missing refs** ÔÇö returns clone/install hint for owasp-scp + owasp-top10
+2. **input-validation** ÔÇö returns allowlist excerpt with source path
+3. **injection** ÔÇö matches SQL/parameterized content across ref trees
+4. **maxChars** ÔÇö truncates with ellipsis (200 char limit in test)
+5. **Unknown topic** ÔÇö lists supported topics
+
+## Implementation Notes
+- Topics use exhaustive `switch` + `never` default per workspace rule
+- Searches `.md/.txt/.adoc/.rst/.html` under `providers/refs/`
+- Scores path hits 3├ù, body hits 1├ù; merges keyword-context excerpts
+- MCP tool defaults `maxChars` to 2000
+
+## Concerns
+- OWASP refs not cloned in this workspace; live `security_refs` returns install hint until `install-providers.ps1` runs
+- Keyword scoring is heuristic; real OWASP tree layout may need tuning after first clone
+
+## Next Steps (Task 8+)
+- `quality_detect` / `quality_check` adapters
+- Wire `security_refs` into orchestrator / `prepare_context`
diff --git a/src/mcp/tools.ts b/src/mcp/tools.ts
index d293c29..acb65dc 100644
--- a/src/mcp/tools.ts
+++ b/src/mcp/tools.ts
@@ -19,10 +19,11 @@ import {
   readHandoff,
   updateHandoff,
   updateProjectState,
 } from "../project/state.js";
 import { getCavemanGuidance } from "../providers/caveman.js";
+import { securityRefs } from "../providers/owasp.js";
 import { getDisciplineRules } from "../providers/ponytail.js";
 import { getAllProviderStatuses } from "../providers/status.js";
 
 function textResult(text: string) {
   return { content: [{ type: "text" as const, text }] };
@@ -234,10 +235,29 @@ export function createServer(): McpServer {
     "Return active compression guidance (context-mode vs caveman) and terse-output hints when caveman is enabled.",
     {},
     async () => textResult(getCavemanGuidance(config)),
   );
 
+  server.tool(
+    "security_refs",
+    "Return compact OWASP secure-coding excerpts for a topic (input-validation, auth, session, crypto, injection, access-control, config, general).",
+    {
+      topic: z
+        .string()
+        .describe(
+          "Security topic: input-validation, auth, session, crypto, injection, access-control, config, general",
+        ),
+      maxChars: z
+        .number()
+        .optional()
+        .default(2000)
+        .describe("Maximum characters to return (default 2000)"),
+    },
+    async ({ topic, maxChars }) =>
+      textResult(securityRefs(config, topic, maxChars ?? 2000)),
+  );
+
   if (config.graphify.enabled) {
     server.tool(
       "graph_query",
       "Query Graphify knowledge graph for the workspace (optional; requires graphify CLI).",
       {
diff --git a/src/providers/owasp.ts b/src/providers/owasp.ts
new file mode 100644
index 0000000..e0f2f87
--- /dev/null
+++ b/src/providers/owasp.ts
@@ -0,0 +1,295 @@
+import { existsSync, readdirSync, readFileSync } from "node:fs";
+import { join, relative, resolve } from "node:path";
+import type { SystemConfig } from "../core/config.js";
+
+export type SecurityTopic =
+  | "input-validation"
+  | "auth"
+  | "session"
+  | "crypto"
+  | "injection"
+  | "access-control"
+  | "config"
+  | "general";
+
+const REFS_ROOT = "providers/refs";
+const OWASP_SCP = "providers/refs/owasp-scp";
+const OWASP_TOP10 = "providers/refs/owasp-top10";
+
+function topicKeywords(topic: SecurityTopic): string[] {
+  switch (topic) {
+    case "input-validation":
+      return [
+        "input",
+        "validation",
+        "validate",
+        "sanitize",
+        "allowlist",
+        "whitelist",
+      ];
+    case "auth":
+      return [
+        "auth",
+        "authentication",
+        "password",
+        "credential",
+        "login",
+        "identity",
+      ];
+    case "session":
+      return ["session", "cookie", "jwt", "token", "logout", "timeout"];
+    case "crypto":
+      return [
+        "crypto",
+        "encrypt",
+        "decrypt",
+        "hash",
+        "cipher",
+        "tls",
+        "certificate",
+      ];
+    case "injection":
+      return [
+        "injection",
+        "sql",
+        "xss",
+        "ldap",
+        "command",
+        "parameterized",
+      ];
+    case "access-control":
+      return [
+        "access",
+        "authorization",
+        "permission",
+        "rbac",
+        "acl",
+        "privilege",
+      ];
+    case "config":
+      return [
+        "config",
+        "configuration",
+        "hardening",
+        "default",
+        "deployment",
+        "misconfiguration",
+      ];
+    case "general":
+      return ["security", "owasp", "risk", "vulnerability", "secure"];
+    default: {
+      const _exhaustive: never = topic;
+      return _exhaustive;
+    }
+  }
+}
+
+const ALL_TOPICS: SecurityTopic[] = [
+  "input-validation",
+  "auth",
+  "session",
+  "crypto",
+  "injection",
+  "access-control",
+  "config",
+  "general",
+];
+
+const TEXT_EXTENSIONS = new Set([
+  ".md",
+  ".txt",
+  ".adoc",
+  ".rst",
+  ".html",
+  ".htm",
+]);
+
+interface ScoredExcerpt {
+  score: number;
+  text: string;
+}
+
+function parseTopic(topic: string): SecurityTopic | null {
+  if ((ALL_TOPICS as string[]).includes(topic)) {
+    return topic as SecurityTopic;
+  }
+  return null;
+}
+
+function installHint(config: SystemConfig): string {
+  const root = config.systemRoot;
+  return `OWASP refs not installed.
+
+Install both reference trees under ${resolve(root, REFS_ROOT)}:
+- git clone --depth 1 https://github.com/OWASP/secure-coding-practices-quick-reference-guide.git ${resolve(root, OWASP_SCP)}
+- git clone --depth 1 https://github.com/OWASP/Top10.git ${resolve(root, OWASP_TOP10)}
+
+Or run: .\\scripts\\install-providers.ps1`;
+}
+
+function refsAvailable(config: SystemConfig): boolean {
+  const root = config.systemRoot;
+  return (
+    existsSync(resolve(root, OWASP_SCP)) ||
+    existsSync(resolve(root, OWASP_TOP10))
+  );
+}
+
+function listTextFiles(dir: string, acc: string[] = []): string[] {
+  if (!existsSync(dir)) {
+    return acc;
+  }
+
+  for (const entry of readdirSync(dir, { withFileTypes: true })) {
+    const fullPath = join(dir, entry.name);
+    if (entry.isDirectory()) {
+      listTextFiles(fullPath, acc);
+      continue;
+    }
+    const ext = entry.name.slice(entry.name.lastIndexOf(".")).toLowerCase();
+    if (TEXT_EXTENSIONS.has(ext)) {
+      acc.push(fullPath);
+    }
+  }
+
+  return acc;
+}
+
+function countKeywordHits(text: string, keywords: string[]): number {
+  const lower = text.toLowerCase();
+  return keywords.reduce(
+    (total, keyword) => total + (lower.includes(keyword) ? 1 : 0),
+    0,
+  );
+}
+
+function excerptAroundKeywords(
+  content: string,
+  keywords: string[],
+  contextLines = 2,
+): string | null {
+  const lines = content.split(/\r?\n/);
+  const hits: number[] = [];
+
+  for (let i = 0; i < lines.length; i += 1) {
+    const lower = lines[i].toLowerCase();
+    if (keywords.some((keyword) => lower.includes(keyword))) {
+      hits.push(i);
+    }
+  }
+
+  if (hits.length === 0) {
+    return null;
+  }
+
+  const ranges: Array<[number, number]> = [];
+  for (const line of hits) {
+    const start = Math.max(0, line - contextLines);
+    const end = Math.min(lines.length - 1, line + contextLines);
+    ranges.push([start, end]);
+  }
+
+  ranges.sort((a, b) => a[0] - b[0]);
+  const merged: Array<[number, number]> = [];
+  for (const range of ranges) {
+    const last = merged[merged.length - 1];
+    if (!last || range[0] > last[1] + 1) {
+      merged.push(range);
+    } else {
+      last[1] = Math.max(last[1], range[1]);
+    }
+  }
+
+  const chunks = merged.map(([start, end]) =>
+    lines.slice(start, end + 1).join("\n").trim(),
+  );
+
+  return chunks.join("\n\n");
+}
+
+function collectExcerpts(
+  config: SystemConfig,
+  topic: SecurityTopic,
+): ScoredExcerpt[] {
+  const keywords = topicKeywords(topic);
+  const refsRoot = resolve(config.systemRoot, REFS_ROOT);
+  const files = listTextFiles(refsRoot);
+  const excerpts: ScoredExcerpt[] = [];
+
+  for (const file of files) {
+    const relPath = relative(refsRoot, file).replace(/\\/g, "/");
+    const content = readFileSync(file, "utf8");
+    const pathHits = countKeywordHits(relPath, keywords);
+    const bodyHits = countKeywordHits(content, keywords);
+    const score = pathHits * 3 + bodyHits;
+
+    if (score === 0) {
+      continue;
+    }
+
+    const excerpt =
+      excerptAroundKeywords(content, keywords) ??
+      content.slice(0, 600).trim();
+
+    excerpts.push({
+      score,
+      text: `## ${relPath}\n\n${excerpt}`,
+    });
+  }
+
+  excerpts.sort((a, b) => b.score - a.score);
+  return excerpts;
+}
+
+function truncate(text: string, maxChars: number): string {
+  if (text.length <= maxChars) {
+    return text;
+  }
+  if (maxChars <= 1) {
+    return "ÔÇª";
+  }
+  return `${text.slice(0, maxChars - 1)}ÔÇª`;
+}
+
+function unknownTopicMessage(topic: string): string {
+  return `Unknown topic: ${topic}
+
+Supported topics: ${ALL_TOPICS.join(", ")}`;
+}
+
+export function securityRefs(
+  config: SystemConfig,
+  topic: string,
+  maxChars = 2000,
+): string {
+  const parsed = parseTopic(topic);
+  if (!parsed) {
+    return unknownTopicMessage(topic);
+  }
+
+  if (!refsAvailable(config)) {
+    return installHint(config);
+  }
+
+  const excerpts = collectExcerpts(config, parsed);
+  if (excerpts.length === 0) {
+    const fallback = `No OWASP excerpts matched topic "${parsed}". Try "general" or install/update refs under ${resolve(config.systemRoot, REFS_ROOT)}.`;
+    return truncate(fallback, maxChars);
+  }
+
+  const header = `OWASP security refs ÔÇö topic: ${parsed}\n\n`;
+  let body = "";
+  for (const excerpt of excerpts) {
+    const next = body ? `${body}\n\n---\n\n${excerpt.text}` : excerpt.text;
+    if (header.length + next.length > maxChars) {
+      break;
+    }
+    body = next;
+  }
+
+  if (!body) {
+    body = excerpts[0].text;
+  }
+
+  return truncate(`${header}${body}`, maxChars);
+}
diff --git a/tests/owasp-refs.test.ts b/tests/owasp-refs.test.ts
new file mode 100644
index 0000000..5511da3
--- /dev/null
+++ b/tests/owasp-refs.test.ts
@@ -0,0 +1,117 @@
+import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
+import { join } from "node:path";
+import { tmpdir } from "node:os";
+import { describe, expect, it } from "vitest";
+import type { SystemConfig } from "../src/core/config.js";
+import { securityRefs } from "../src/providers/owasp.js";
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
+function seedOwaspRefs(root: string): void {
+  const scpDir = join(root, "providers", "refs", "owasp-scp");
+  const top10Dir = join(root, "providers", "refs", "owasp-top10");
+  mkdirSync(join(scpDir, "en"), { recursive: true });
+  mkdirSync(top10Dir, { recursive: true });
+
+  writeFileSync(
+    join(scpDir, "en", "input-validation.md"),
+    `# Input Validation
+
+Validate all input at trust boundaries. Use allowlists, not denylists.
+Reject unexpected types early. Sanitize only when necessary.`,
+  );
+
+  writeFileSync(
+    join(top10Dir, "A03-injection.md"),
+    `# Injection
+
+Never concatenate user input into SQL queries.
+Use parameterized queries and prepared statements.`,
+  );
+
+  writeFileSync(
+    join(top10Dir, "A01-access-control.md"),
+    `# Broken Access Control
+
+Enforce authorization on every request. Deny by default.`,
+  );
+}
+
+describe("securityRefs", () => {
+  it("returns install hint when OWASP refs are missing", () => {
+    const root = mkdtempSync(join(tmpdir(), "acs-owasp-missing-"));
+    const result = securityRefs(base({ systemRoot: root }), "general");
+
+    expect(result.toLowerCase()).toContain("install");
+    expect(result).toMatch(/owasp-scp|secure-coding-practices/i);
+    expect(result).toMatch(/owasp-top10|Top10/i);
+  });
+
+  it("returns topic excerpts from installed refs", () => {
+    const root = mkdtempSync(join(tmpdir(), "acs-owasp-present-"));
+    seedOwaspRefs(root);
+
+    const result = securityRefs(base({ systemRoot: root }), "input-validation");
+
+    expect(result.toLowerCase()).toContain("input validation");
+    expect(result.toLowerCase()).toContain("allowlist");
+    expect(result).toContain("input-validation.md");
+  });
+
+  it("matches injection topic across ref trees", () => {
+    const root = mkdtempSync(join(tmpdir(), "acs-owasp-injection-"));
+    seedOwaspRefs(root);
+
+    const result = securityRefs(base({ systemRoot: root }), "injection");
+
+    expect(result.toLowerCase()).toContain("injection");
+    expect(result.toLowerCase()).toMatch(/sql|parameterized/);
+  });
+
+  it("truncates output to maxChars", () => {
+    const root = mkdtempSync(join(tmpdir(), "acs-owasp-truncate-"));
+    seedOwaspRefs(root);
+    writeFileSync(
+      join(root, "providers", "refs", "owasp-scp", "en", "input-validation.md"),
+      "Validate everything. ".repeat(500),
+    );
+
+    const result = securityRefs(
+      base({ systemRoot: root }),
+      "input-validation",
+      200,
+    );
+
+    expect(result.length).toBeLessThanOrEqual(200);
+    expect(result.endsWith("ÔÇª")).toBe(true);
+  });
+
+  it("rejects unknown topics", () => {
+    const result = securityRefs(base(), "not-a-topic");
+
+    expect(result.toLowerCase()).toContain("unknown topic");
+    expect(result).toContain("input-validation");
+    expect(result).toContain("access-control");
+  });
+});
