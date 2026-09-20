# T10
BASE: 248916c73a65674a44df4f06976babb3c642d24e
HEAD: f67ad5e3769d4e239f86e3118e4f039c44bba752
## Commits
f67ad5e feat: selective claude-mem memory tools (non-SoT)
## Stat
 docs/PROVIDERS.md          |  2 +-
 src/mcp/tools.ts           | 23 ++++++++++++
 src/providers/claudeMem.ts | 72 +++++++++++++++++++++++++++++++++++
 tests/claude-mem.test.ts   | 93 ++++++++++++++++++++++++++++++++++++++++++++++
 4 files changed, 189 insertions(+), 1 deletion(-)
## Diff
diff --git a/docs/PROVIDERS.md b/docs/PROVIDERS.md
index c3531a6..c9813fb 100644
--- a/docs/PROVIDERS.md
+++ b/docs/PROVIDERS.md
@@ -22,11 +22,11 @@ are reported but do not fail the script, so it is safe to rerun.
 | OpenCodeReview | Code review | Installs global npm package `@alibaba-group/open-code-review`; its expected CLI is `ocr`. |
 | Ponytail | Implementation discipline | Shallow-cloned to `providers/skills/ponytail`. An existing checkout is left unchanged. |
 | Caveman | Output compression | Shallow-cloned to `providers/skills/caveman`. It is installed but config-disabled by default because ACS compression modes are mutually exclusive. |
 | OWASP Secure Coding Practices | Security reference | Shallow-cloned to `providers/refs/owasp-scp`. |
 | OWASP Top 10 | Security reference | Shallow-cloned to `providers/refs/owasp-top10`. |
-| Claude-Mem | Historical memory | Not installed automatically. Run `npx claude-mem install --provider host` when ready; the installer does not force cloud sign-in. |
+| Claude-Mem | Historical memory | Not installed automatically. Run `npx claude-mem install --provider host` when ready; the installer does not force cloud sign-in. ACS defaults to `http://127.0.0.1:37777`, but current Claude-Mem releases assign a per-user port (`37700 + uid % 100`) and store it in `~/.claude-mem/settings.json`; set `CLAUDE_MEM_WORKER_URL` to the active base URL when it differs. |
 | Semgrep | Fast security scanning | Installed with user-scoped `pip` unless already available or `-SkipHeavy` is set. Failure is non-fatal. |
 | CodeQL | Deep security analysis | Detection only. Install the [CodeQL CLI](https://docs.github.com/en/code-security/codeql-cli) manually when needed. |
 | Bearer | Data-flow security analysis | Detection only. Install the [Bearer CLI](https://docs.bearer.com/guides/installation/) manually when needed. |
 | Prettier | Formatting | Detected in each target project; no source repository is cloned. |
 | ESLint | JavaScript quality | Detected in each target project; no source repository is cloned. |
diff --git a/src/mcp/tools.ts b/src/mcp/tools.ts
index da34c14..f20b564 100644
--- a/src/mcp/tools.ts
+++ b/src/mcp/tools.ts
@@ -19,10 +19,11 @@ import {
   readHandoff,
   updateHandoff,
   updateProjectState,
 } from "../project/state.js";
 import { getCavemanGuidance } from "../providers/caveman.js";
+import { memoryGet, memorySearch } from "../providers/claudeMem.js";
 import { runOpenCodeReview } from "../providers/openCodeReview.js";
 import { securityRefs } from "../providers/owasp.js";
 import { getDisciplineRules } from "../providers/ponytail.js";
 import {
   detectQualityStack,
@@ -226,10 +227,32 @@ export function createServer(): McpServer {
     {},
     async () =>
       textResult(JSON.stringify(getAllProviderStatuses(config), null, 2)),
   );
 
+  server.tool(
+    "memory_search",
+    "Search the optional Claude-Mem index and return compact results with observation IDs. Claude-Mem is selective memory only; ACS remains the source of truth.",
+    {
+      query: z.string().min(1).describe("Memory search query"),
+      limit: z.number().int().min(1).max(100).optional().default(10),
+    },
+    async ({ query, limit }) =>
+      textResult(await memorySearch(config, query, limit ?? 10)),
+  );
+
+  server.tool(
+    "memory_get",
+    "Fetch full Claude-Mem details only for explicitly selected observation IDs.",
+    {
+      ids: z
+        .array(z.number().int().positive())
+        .describe("Claude-Mem observation IDs to retrieve"),
+    },
+    async ({ ids }) => textResult(await memoryGet(config, ids)),
+  );
+
   server.tool(
     "discipline_rules",
     "Return compact Ponytail YAGNI ladder and safety carve-outs for implementation discipline.",
     {},
     async () => textResult(getDisciplineRules(config)),
diff --git a/src/providers/claudeMem.ts b/src/providers/claudeMem.ts
new file mode 100644
index 0000000..73f27c4
--- /dev/null
+++ b/src/providers/claudeMem.ts
@@ -0,0 +1,72 @@
+import type { SystemConfig } from "../core/config.js";
+
+const DEFAULT_WORKER_URL = "http://127.0.0.1:37777";
+const INSTALL_COMMAND = "npx claude-mem install --provider host";
+const REQUEST_TIMEOUT_MS = 10_000;
+
+function workerUrl(): string {
+  return (process.env.CLAUDE_MEM_WORKER_URL || DEFAULT_WORKER_URL).replace(
+    /\/+$/,
+    "",
+  );
+}
+
+function disabledMessage(): string {
+  return "Claude-Mem memory is disabled in config (memory.enabled=false).";
+}
+
+function unavailableMessage(error: unknown): string {
+  const detail = error instanceof Error ? error.message : String(error);
+  return [
+    `Claude-Mem worker is unavailable at ${workerUrl()}: ${detail}`,
+    `Install/start it with: ${INSTALL_COMMAND}`,
+    "If its worker uses another port, set CLAUDE_MEM_WORKER_URL to the active worker base URL.",
+  ].join("\n");
+}
+
+async function request(url: string, init?: RequestInit): Promise<string> {
+  try {
+    const response = await fetch(url, {
+      ...init,
+      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
+    });
+    if (!response.ok) {
+      throw new Error(`HTTP ${response.status} ${response.statusText}`.trim());
+    }
+    return await response.text();
+  } catch (error) {
+    return unavailableMessage(error);
+  }
+}
+
+export async function memorySearch(
+  config: SystemConfig,
+  query: string,
+  limit = 10,
+): Promise<string> {
+  if (!config.memory.enabled) return disabledMessage();
+
+  const params = new URLSearchParams({
+    query,
+    type: "observations",
+    format: "index",
+    limit: String(limit),
+  });
+  return request(`${workerUrl()}/api/search?${params.toString()}`);
+}
+
+export async function memoryGet(
+  config: SystemConfig,
+  ids: number[],
+): Promise<string> {
+  if (!config.memory.enabled) return disabledMessage();
+  if (ids.length === 0) {
+    return "No Claude-Mem observation IDs requested.";
+  }
+
+  return request(`${workerUrl()}/api/observations/batch`, {
+    method: "POST",
+    headers: { "content-type": "application/json" },
+    body: JSON.stringify({ ids }),
+  });
+}
diff --git a/tests/claude-mem.test.ts b/tests/claude-mem.test.ts
new file mode 100644
index 0000000..a29aaa1
--- /dev/null
+++ b/tests/claude-mem.test.ts
@@ -0,0 +1,93 @@
+import { afterEach, describe, expect, it, vi } from "vitest";
+import type { SystemConfig } from "../src/core/config.js";
+import { memoryGet, memorySearch } from "../src/providers/claudeMem.js";
+
+function config(enabled = true): SystemConfig {
+  return {
+    systemRoot: "C:\\AI-Coding-System",
+    projectRoots: ["D:\\"],
+    identity: { hashLength: 20 },
+    graphify: { enabled: true, preferCodeOnly: true },
+    memory: { enabled, provider: "claude-mem" },
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
+afterEach(() => {
+  vi.restoreAllMocks();
+  delete process.env.CLAUDE_MEM_WORKER_URL;
+});
+
+describe("Claude-Mem selective retrieval", () => {
+  it("searches the worker and returns its JSON response", async () => {
+    process.env.CLAUDE_MEM_WORKER_URL = "http://127.0.0.1:39999/";
+    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
+      new Response(JSON.stringify({ results: [{ id: 42, title: "Decision" }] }), {
+        status: 200,
+        headers: { "content-type": "application/json" },
+      }),
+    );
+
+    const result = await memorySearch(config(), "auth migration", 3);
+
+    expect(JSON.parse(result)).toEqual({
+      results: [{ id: 42, title: "Decision" }],
+    });
+    const url = new URL(String(fetchMock.mock.calls[0]?.[0]));
+    expect(`${url.origin}${url.pathname}`).toBe(
+      "http://127.0.0.1:39999/api/search",
+    );
+    expect(url.searchParams.get("query")).toBe("auth migration");
+    expect(url.searchParams.get("type")).toBe("observations");
+    expect(url.searchParams.get("format")).toBe("index");
+    expect(url.searchParams.get("limit")).toBe("3");
+  });
+
+  it("gets only the requested observation ids", async () => {
+    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
+      new Response(JSON.stringify([{ id: 7 }, { id: 11 }]), { status: 200 }),
+    );
+
+    const result = await memoryGet(config(), [7, 11]);
+
+    expect(JSON.parse(result)).toEqual([{ id: 7 }, { id: 11 }]);
+    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
+      "http://127.0.0.1:37777/api/observations/batch",
+    );
+    const init = fetchMock.mock.calls[0]?.[1];
+    expect(init?.method).toBe("POST");
+    expect(JSON.parse(String(init?.body))).toEqual({ ids: [7, 11] });
+  });
+
+  it("does not contact the worker when memory is disabled", async () => {
+    const fetchMock = vi.spyOn(globalThis, "fetch");
+
+    await expect(memorySearch(config(false), "anything")).resolves.toMatch(
+      /disabled/i,
+    );
+    await expect(memoryGet(config(false), [1])).resolves.toMatch(/disabled/i);
+    expect(fetchMock).not.toHaveBeenCalled();
+  });
+
+  it("returns an actionable install hint when the worker is unavailable", async () => {
+    vi.spyOn(globalThis, "fetch").mockRejectedValue(
+      new Error("connect ECONNREFUSED"),
+    );
+
+    const result = await memorySearch(config(), "anything");
+
+    expect(result).toContain("npx claude-mem install --provider host");
+    expect(result).toMatch(/CLAUDE_MEM_WORKER_URL/);
+  });
+});
