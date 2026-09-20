# Provider MCP Facade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend AI Coding System into one MCP facade that toggles and routes Graphify, Claude-Mem, Ponytail, Caveman/Context Mode, OpenCodeReview, quality tools, OWASP refs, and security scanners—while ACS `projects\<id>\` remains the only durable project source of truth.

**Architecture:** Expand `config/system.json` + `providers/registry.json`; add thin provider adapters under `src/providers/`; register new MCP tools on the existing server; install external tools under `providers/` or via package managers (not as SoT). Context Mode preferred for tool compression; Caveman off by default when Context Mode is on.

**Tech Stack:** TypeScript (Node ≥20), `@modelcontextprotocol/sdk`, Zod, Vitest, Windows PowerShell; optional CLIs: graphify, ocr, semgrep, biome/eslint/prettier, claude-mem worker.

**Spec:** `docs/superpowers/specs/2026-09-20-provider-mcp-facade-design.md`

## Global Constraints

- Editors configure **only** `ai-coding-system` MCP (`node C:\AI-Coding-System\dist\index.js`).
- Canonical state: `C:\AI-Coding-System\projects\<project-id>\context\` — never Claude-Mem / Context Mode / Graphify as SoT.
- Do **not** auto-merge memory DBs or OWASP full docs into `get_project_context`.
- `contextMode.enabled` XOR active caveman compression path by default (`caveman.enabled: false` when contextMode on).
- Do **not** install Prettier+Biome or ESLint+Biome together for the same target project; detect existing tooling.
- Do **not** run Semgrep+CodeQL+Bearer on every task; use light/normal/deep policy.
- Do **not** run `npm run build` after every file edit; `maxBuildAttempts = 3` at task end.
- Temp files only under `projects\<id>\temp\<session-id>\`.
- Reviews under `projects\<id>\reviews\`.
- Optional providers must degrade with install hints; never crash `doctor` or MCP startup.
- Prefer package CLIs / shallow clones; do not vendor full Prettier/ESLint/CodeQL source trees.
- Repo is currently **not** a git repository; Task 0 initializes git if committing. Use `"C:\Program Files\Git\bin\git.exe"` if `git` is not on PATH.
- Exhaustive `switch` defaults with `never` for TypeScript unions (workspace rule).
- Imports at top of files only (workspace rule).

## File structure (create / modify)

| Path | Responsibility |
|------|----------------|
| `config/system.json` | Provider toggles |
| `src/core/config.ts` | Typed config + defaults + merge |
| `providers/registry.json` | Install method, path, status per provider |
| `src/providers/types.ts` | Shared `ProviderId`, `ProviderStatus` |
| `src/providers/registry.ts` | Load registry + status helpers |
| `src/providers/which.ts` | Cross-cutting CLI detection |
| `src/providers/compression.ts` | Enforce contextMode XOR caveman |
| `src/providers/ponytail.ts` | Discipline rules text + path check |
| `src/providers/caveman.ts` | Status + compact hint |
| `src/providers/contextMode.ts` | Status + install hint |
| `src/providers/claudeMem.ts` | Selective HTTP/search client stub |
| `src/providers/openCodeReview.ts` | `ocr` invoke + write reviews |
| `src/providers/quality.ts` | Detect Prettier/ESLint/Biome; run check |
| `src/providers/owasp.ts` | Topic-scoped snippet from `providers/refs/` |
| `src/security/scan.ts` | light/normal/deep orchestration |
| `src/orchestrator/prepareContext.ts` | Priority-ordered context assembly |
| `src/orchestrator/finalizeTask.ts` | End-of-task workflow |
| `src/core/paths.ts` | `reviewsDir`, `tempDir`, `providersDir` |
| `src/doctor.ts` | All provider checks |
| `src/mcp/tools.ts` | Register new tools |
| `scripts/install-providers.ps1` | Idempotent provider installs |
| `docs/PROVIDERS.md` | How each provider is used |
| `examples/cursor-rule.mdc` | Point agents at facade tools |
| `tests/*.test.ts` | Unit tests per task |

---

### Task 0: Initialize git (if missing)

**Files:**
- Create: `.git/` via `git init`
- Modify: none (`.gitignore` already exists)

- [ ] **Step 1: Check for `.git`**

Run (PowerShell):
```powershell
Test-Path C:\AI-Coding-System\.git
```
Expected: `False` (currently) or `True` if already initialized.

- [ ] **Step 2: Init if missing**

```powershell
& "C:\Program Files\Git\bin\git.exe" -C C:\AI-Coding-System init
& "C:\Program Files\Git\bin\git.exe" -C C:\AI-Coding-System add -A
& "C:\Program Files\Git\bin\git.exe" -C C:\AI-Coding-System status
```

- [ ] **Step 3: Initial commit of current baseline (only if no commits yet)**

```powershell
& "C:\Program Files\Git\bin\git.exe" -C C:\AI-Coding-System commit -m "chore: baseline AI Coding System before provider facade"
```

Do not force if user already has commits. Skip if `git log` already has history.

---

### Task 1: Extend SystemConfig + system.json

**Files:**
- Modify: `config/system.json`
- Modify: `src/core/config.ts`
- Test: `tests/config-providers.test.ts`

**Interfaces:**
- Produces: `SystemConfig` with `memory`, `ponytail`, `caveman`, `contextMode`, `review`, `security`, `validation` fields as in the spec §9.

- [ ] **Step 1: Write the failing test**

Create `tests/config-providers.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { loadConfig } from "../src/core/config.js";

describe("provider config", () => {
  it("loads memory, contextMode, caveman, review, security, validation defaults", () => {
    const config = loadConfig();
    expect(config.memory.enabled).toBe(true);
    expect(config.memory.provider).toBe("claude-mem");
    expect(config.contextMode.enabled).toBe(true);
    expect(config.caveman.enabled).toBe(false);
    expect(config.ponytail.enabled).toBe(true);
    expect(config.review.openCodeReview.enabled).toBe(true);
    expect(config.security.semgrep.enabled).toBe(true);
    expect(config.security.codeql.enabled).toBe(false);
    expect(config.security.bearer.enabled).toBe(false);
    expect(config.security.defaultPolicy).toBe("light");
    expect(config.validation.maxBuildAttempts).toBe(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/config-providers.test.ts`
Expected: FAIL (properties missing on `SystemConfig`).

- [ ] **Step 3: Update `src/core/config.ts`**

Replace the `SystemConfig` interface and `DEFAULT_CONFIG` / merge logic with:

```typescript
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export type SecurityPolicy = "light" | "normal" | "deep";

export interface SystemConfig {
  systemRoot: string;
  projectRoots: string[];
  identity: { hashLength: number };
  graphify: { enabled: boolean; preferCodeOnly: boolean };
  memory: { enabled: boolean; provider: "claude-mem" };
  ponytail: { enabled: boolean };
  caveman: { enabled: boolean };
  contextMode: { enabled: boolean };
  review: { openCodeReview: { enabled: boolean } };
  security: {
    semgrep: { enabled: boolean };
    codeql: { enabled: boolean };
    bearer: { enabled: boolean };
    defaultPolicy: SecurityPolicy;
  };
  validation: { maxBuildAttempts: number };
  telemetry: { enabled: boolean };
}

const DEFAULT_CONFIG: SystemConfig = {
  systemRoot: "C:\\AI-Coding-System",
  projectRoots: ["D:\\"],
  identity: { hashLength: 20 },
  graphify: { enabled: true, preferCodeOnly: true },
  memory: { enabled: true, provider: "claude-mem" },
  ponytail: { enabled: true },
  caveman: { enabled: false },
  contextMode: { enabled: true },
  review: { openCodeReview: { enabled: true } },
  security: {
    semgrep: { enabled: true },
    codeql: { enabled: false },
    bearer: { enabled: false },
    defaultPolicy: "light",
  },
  validation: { maxBuildAttempts: 3 },
  telemetry: { enabled: false },
};

function resolveSystemRoot(): string {
  const fromEnv = process.env.AI_CODING_SYSTEM_ROOT;
  if (fromEnv) return fromEnv;
  const here = dirname(fileURLToPath(import.meta.url));
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
    memory: { ...DEFAULT_CONFIG.memory, ...raw.memory },
    ponytail: { ...DEFAULT_CONFIG.ponytail, ...raw.ponytail },
    caveman: { ...DEFAULT_CONFIG.caveman, ...raw.caveman },
    contextMode: { ...DEFAULT_CONFIG.contextMode, ...raw.contextMode },
    review: {
      openCodeReview: {
        ...DEFAULT_CONFIG.review.openCodeReview,
        ...raw.review?.openCodeReview,
      },
    },
    security: {
      ...DEFAULT_CONFIG.security,
      ...raw.security,
      semgrep: { ...DEFAULT_CONFIG.security.semgrep, ...raw.security?.semgrep },
      codeql: { ...DEFAULT_CONFIG.security.codeql, ...raw.security?.codeql },
      bearer: { ...DEFAULT_CONFIG.security.bearer, ...raw.security?.bearer },
    },
    validation: { ...DEFAULT_CONFIG.validation, ...raw.validation },
    telemetry: { ...DEFAULT_CONFIG.telemetry, ...raw.telemetry },
  };
}
```

- [ ] **Step 4: Update `config/system.json`** to match DEFAULT_CONFIG fields (keep `systemRoot` / `projectRoots`).

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/config-providers.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```powershell
& "C:\Program Files\Git\bin\git.exe" -C C:\AI-Coding-System add config/system.json src/core/config.ts tests/config-providers.test.ts
& "C:\Program Files\Git\bin\git.exe" -C C:\AI-Coding-System commit -m "feat: extend system config with provider toggles"
```

---

### Task 2: Compression XOR policy

**Files:**
- Create: `src/providers/compression.ts`
- Test: `tests/compression.test.ts`

**Interfaces:**
- Consumes: `SystemConfig`
- Produces: `activeCompressionProvider(config): "context-mode" | "caveman" | "none"` and `assertCompressionPolicy(config): { ok: boolean; detail: string }`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import {
  activeCompressionProvider,
  assertCompressionPolicy,
} from "../src/providers/compression.js";
import type { SystemConfig } from "../src/core/config.js";

function base(partial: Partial<SystemConfig> = {}): SystemConfig {
  return {
    systemRoot: "C:\\AI-Coding-System",
    projectRoots: ["D:\\"],
    identity: { hashLength: 20 },
    graphify: { enabled: true, preferCodeOnly: true },
    memory: { enabled: true, provider: "claude-mem" },
    ponytail: { enabled: true },
    caveman: { enabled: false },
    contextMode: { enabled: true },
    review: { openCodeReview: { enabled: true } },
    security: {
      semgrep: { enabled: true },
      codeql: { enabled: false },
      bearer: { enabled: false },
      defaultPolicy: "light",
    },
    validation: { maxBuildAttempts: 3 },
    telemetry: { enabled: false },
    ...partial,
  };
}

describe("compression policy", () => {
  it("prefers context-mode when enabled and caveman off", () => {
    expect(activeCompressionProvider(base())).toBe("context-mode");
    expect(assertCompressionPolicy(base()).ok).toBe(true);
  });

  it("uses caveman when contextMode off and caveman on", () => {
    const c = base({
      contextMode: { enabled: false },
      caveman: { enabled: true },
    });
    expect(activeCompressionProvider(c)).toBe("caveman");
  });

  it("warns when both enabled (overlap)", () => {
    const c = base({
      contextMode: { enabled: true },
      caveman: { enabled: true },
    });
    const result = assertCompressionPolicy(c);
    expect(result.ok).toBe(false);
    expect(result.detail.toLowerCase()).toContain("overlap");
    // Active path still prefers context-mode to avoid double compression
    expect(activeCompressionProvider(c)).toBe("context-mode");
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

`npm test -- tests/compression.test.ts`

- [ ] **Step 3: Implement `src/providers/compression.ts`**

```typescript
import type { SystemConfig } from "../core/config.js";

export type CompressionProvider = "context-mode" | "caveman" | "none";

export function activeCompressionProvider(
  config: SystemConfig,
): CompressionProvider {
  if (config.contextMode.enabled) return "context-mode";
  if (config.caveman.enabled) return "caveman";
  return "none";
}

export function assertCompressionPolicy(config: SystemConfig): {
  ok: boolean;
  detail: string;
} {
  if (config.contextMode.enabled && config.caveman.enabled) {
    return {
      ok: false,
      detail:
        "overlap: contextMode and caveman both enabled — disable one; active path uses context-mode",
    };
  }
  const active = activeCompressionProvider(config);
  return { ok: true, detail: `active compression: ${active}` };
}
```

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit**

```powershell
& "C:\Program Files\Git\bin\git.exe" -C C:\AI-Coding-System add src/providers/compression.ts tests/compression.test.ts
& "C:\Program Files\Git\bin\git.exe" -C C:\AI-Coding-System commit -m "feat: enforce contextMode XOR caveman compression policy"
```

---

### Task 3: Provider registry + paths + which helper

**Files:**
- Create: `providers/registry.json`
- Create: `src/providers/types.ts`
- Create: `src/providers/registry.ts`
- Create: `src/providers/which.ts`
- Modify: `src/core/paths.ts` — add `providersDir`, `reviewsDir`, `tempSessionDir`
- Test: `tests/provider-registry.test.ts`

**Interfaces:**
- Produces:
  - `providersDir(config): string`
  - `reviewsDir(config, projectId): string`
  - `tempSessionDir(config, projectId, sessionId): string`
  - `loadProviderRegistry(config): ProviderRegistry`
  - `cliAvailable(cmd: string): boolean`

- [ ] **Step 1: Write failing test** `tests/provider-registry.test.ts` asserting registry loads and lists ids: `graphify`, `claude-mem`, `ponytail`, `caveman`, `context-mode`, `open-code-review`, `owasp-scp`, `owasp-top10`, `semgrep`, `codeql`, `bearer`, `prettier`, `eslint`, `biome`.

- [ ] **Step 2: Create `providers/registry.json`** with entries shaped:

```json
{
  "providers": [
    {
      "id": "graphify",
      "role": "code-structure",
      "install": "uv tool install graphifyy",
      "cli": "graphify",
      "checkout": null
    },
    {
      "id": "claude-mem",
      "role": "historical-memory",
      "install": "npx claude-mem install --provider host",
      "cli": null,
      "checkout": null
    },
    {
      "id": "ponytail",
      "role": "implementation-discipline",
      "install": "git clone --depth 1 https://github.com/DietrichGebert/ponytail.git providers/skills/ponytail",
      "cli": null,
      "checkout": "providers/skills/ponytail"
    },
    {
      "id": "caveman",
      "role": "output-compression",
      "install": "git clone --depth 1 https://github.com/JuliusBrussee/caveman.git providers/skills/caveman",
      "cli": null,
      "checkout": "providers/skills/caveman"
    },
    {
      "id": "context-mode",
      "role": "tool-context-control",
      "install": "npm install -g context-mode",
      "cli": null,
      "checkout": null
    },
    {
      "id": "open-code-review",
      "role": "code-review",
      "install": "npm install -g @alibaba-group/open-code-review",
      "cli": "ocr",
      "checkout": null
    },
    {
      "id": "owasp-scp",
      "role": "security-knowledge",
      "install": "git clone --depth 1 https://github.com/OWASP/secure-coding-practices-quick-reference-guide.git providers/refs/owasp-scp",
      "cli": null,
      "checkout": "providers/refs/owasp-scp"
    },
    {
      "id": "owasp-top10",
      "role": "security-knowledge",
      "install": "git clone --depth 1 https://github.com/OWASP/Top10.git providers/refs/owasp-top10",
      "cli": null,
      "checkout": "providers/refs/owasp-top10"
    },
    {
      "id": "semgrep",
      "role": "fast-security",
      "install": "pip install semgrep",
      "cli": "semgrep",
      "checkout": null
    },
    {
      "id": "codeql",
      "role": "deep-security",
      "install": "manual — install CodeQL CLI if needed",
      "cli": "codeql",
      "checkout": null
    },
    {
      "id": "bearer",
      "role": "dataflow-security",
      "install": "manual — install Bearer CLI if needed",
      "cli": "bearer",
      "checkout": null
    },
    {
      "id": "prettier",
      "role": "formatting",
      "install": "detect in target project",
      "cli": "prettier",
      "checkout": null
    },
    {
      "id": "eslint",
      "role": "js-quality",
      "install": "detect in target project",
      "cli": "eslint",
      "checkout": null
    },
    {
      "id": "biome",
      "role": "format-lint-unified",
      "install": "detect in target project",
      "cli": "biome",
      "checkout": null
    }
  ]
}
```

- [ ] **Step 3: Implement types, registry loader, `cliAvailable`, path helpers**

Add to `paths.ts`:

```typescript
export function providersDir(config: SystemConfig): string {
  return join(config.systemRoot, "providers");
}

export function reviewsDir(config: SystemConfig, projectId: string): string {
  return join(projectDir(config, projectId), "reviews");
}

export function tempSessionDir(
  config: SystemConfig,
  projectId: string,
  sessionId: string,
): string {
  return join(projectDir(config, projectId), "temp", sessionId);
}
```

- [ ] **Step 4: Pass tests + commit**

```powershell
& "C:\Program Files\Git\bin\git.exe" -C C:\AI-Coding-System add providers/registry.json src/providers src/core/paths.ts tests/provider-registry.test.ts
& "C:\Program Files\Git\bin\git.exe" -C C:\AI-Coding-System commit -m "feat: add provider registry and path helpers"
```

---

### Task 4: Provider status + doctor expansion + `provider_status` MCP tool

**Files:**
- Create: `src/providers/status.ts`
- Modify: `src/doctor.ts`
- Modify: `src/mcp/tools.ts`
- Test: `tests/provider-status.test.ts`

**Interfaces:**
- Produces: `getAllProviderStatuses(config): ProviderStatusRow[]` where each row has `{ id, role, enabledInConfig, available, detail }`
- Doctor includes optional provider rows without failing overall health for missing optionals.

- [ ] **Step 1: Failing test** — `getAllProviderStatuses` returns ≥14 rows; compression overlap surfaces when both flags true.

- [ ] **Step 2: Implement status checks** using `cliAvailable`, `existsSync(checkout)`, config enabled flags, and `assertCompressionPolicy`.

- [ ] **Step 3: Wire `doctor` + MCP `provider_status` tool** returning JSON of statuses.

- [ ] **Step 4: `npm test` + `npm run build`** — both pass.

- [ ] **Step 5: Commit** — `feat: provider status surface in doctor and MCP`

---

### Task 5: Install script (P1 providers)

**Files:**
- Create: `scripts/install-providers.ps1`
- Create: `docs/PROVIDERS.md`
- Modify: `.gitignore` — ignore `providers/skills/`, `providers/refs/` checkouts if large (keep `registry.json`)

**Install targets (idempotent):**

1. Graphify: `uv tool install graphifyy` (or pipx) if missing  
2. Context Mode: `npm install -g context-mode` if package exists; else document MCP peer install from README  
3. OpenCodeReview: `npm install -g @alibaba-group/open-code-review`  
4. Ponytail: shallow clone → `providers/skills/ponytail`  
5. Caveman: shallow clone → `providers/skills/caveman` (installed but config-disabled by default)  
6. OWASP SCP + Top10: shallow clones → `providers/refs/`  
7. Claude-Mem: print install command `npx claude-mem install --provider host` (do not force cloud sign-in in CI); record status  
8. Semgrep: try `pip install semgrep` / winget; soft-fail  
9. CodeQL / Bearer: detect only; document manual install  
10. Do **not** clone prettier/eslint/biome repos

- [ ] **Step 1: Write script** with `-SkipHeavy` switch (skip semgrep/codeql/bearer installs).

- [ ] **Step 2: Run**

```powershell
powershell -ExecutionPolicy Bypass -File C:\AI-Coding-System\scripts\install-providers.ps1 -SkipHeavy
```

- [ ] **Step 3: Verify** checkouts exist and `provider_status` / doctor reflect them.

- [ ] **Step 4: Document** Cursor one-MCP entry remains unchanged; optional Context Mode peer note if ACS cannot proxy yet.

- [ ] **Step 5: Commit** script + docs (not large checkouts if gitignored).

---

### Task 6: Ponytail `discipline_rules` + Caveman hint tools

**Files:**
- Create: `src/providers/ponytail.ts`
- Create: `src/providers/caveman.ts`
- Modify: `src/mcp/tools.ts`
- Create: `providers/skills/README.md` (how to run ponytail Cursor hooks installer)
- Test: `tests/discipline-rules.test.ts`

**Interfaces:**
- `getDisciplineRules(config): string` — compact 7-rung ladder + safety carve-outs (hardcoded ACS copy aligned with Ponytail README; optionally append path to checkout).
- `getCavemanGuidance(config): string` — only if caveman enabled; else message that context-mode is active.

- [ ] **Step 1–4:** TDD for rules non-empty; MCP tools `discipline_rules`, and optional `compression_guidance`.
- [ ] **Step 5: Commit** — `feat: expose ponytail discipline and compression guidance tools`

---

### Task 7: OWASP topic refs tool

**Files:**
- Create: `src/providers/owasp.ts`
- Modify: `src/mcp/tools.ts`
- Test: `tests/owasp-refs.test.ts`

**Interfaces:**
- `securityRefs(config, topic: string, maxChars = 2000): string` — search `providers/refs/` for files matching topic keywords; return truncated excerpts; if refs missing, return install hint.

Topics enum (exhaustive switch): `"input-validation" | "auth" | "session" | "crypto" | "injection" | "access-control" | "config" | "general"`.

- [ ] TDD + MCP tool `security_refs` + commit `feat: task-scoped OWASP security refs tool`

---

### Task 8: Quality detect/check

**Files:**
- Create: `src/providers/quality.ts`
- Modify: `src/mcp/tools.ts`
- Test: `tests/quality-detect.test.ts`

**Interfaces:**
- `detectQualityStack(workspacePath: string): { formatter: "prettier" | "biome" | "none"; linter: "eslint" | "biome" | "none"; conflict: boolean; detail: string }`
- Conflict true if Prettier+Biome or ESLint+Biome both configured — do not auto-run both.
- `runQualityCheck(workspacePath: string): string` — run only non-conflicting detected tools; truncate output to 4k chars.

Detection: look for `biome.json`, `.prettierrc*`, `eslint.config.*`, `package.json` scripts/deps.

- [ ] TDD with temp fixture dirs + MCP `quality_detect` / `quality_check` + commit.

---

### Task 9: OpenCodeReview adapter

**Files:**
- Create: `src/providers/openCodeReview.ts`
- Modify: `src/project/register.ts` or paths ensure `reviews/` on register
- Modify: `src/mcp/tools.ts`
- Test: `tests/review-paths.test.ts`

**Interfaces:**
- `runOpenCodeReview(config, { workspacePath, projectId, mode: "diff" | "scan" }): string` — if `ocr` missing, return install hint; else run `ocr review --format json` (diff) or `ocr scan --format json` with output file under `reviewsDir`; return path + truncated summary.

- [ ] Ensure `registerProject` creates `reviews/` and `temp/` directories.
- [ ] MCP: `review_diff`, `review_scan`
- [ ] Commit `feat: OpenCodeReview provider writing to projects/<id>/reviews`

---

### Task 10: Claude-Mem selective memory tools

**Files:**
- Create: `src/providers/claudeMem.ts`
- Modify: `src/mcp/tools.ts`
- Test: `tests/claude-mem.test.ts`

**Interfaces:**
- Read worker base URL from env `CLAUDE_MEM_WORKER_URL` default `http://127.0.0.1:37777` (adjust after checking local claude-mem docs at install time).
- `memorySearch(query, limit=10): string` — HTTP GET/POST to worker search; on failure return actionable hint (`npx claude-mem install --provider host`).
- `memoryGet(ids: number[]): string` — fetch only requested ids.
- Never call these from `get_project_context`.

- [ ] MCP: `memory_search`, `memory_get` (timeline optional if API supports)
- [ ] Unit test: mock fetch or test “unavailable” path deterministically.
- [ ] Commit `feat: selective claude-mem memory tools (non-SoT)`

---

### Task 11: Security orchestrator

**Files:**
- Create: `src/security/scan.ts`
- Modify: `src/mcp/tools.ts`
- Test: `tests/security-scan.test.ts`

**Interfaces:**
- `runSecurityScan(config, { workspacePath, policy?: SecurityPolicy }): string`
- `light`: semgrep if enabled+available else “skipped”
- `normal`: light + note to run review
- `deep`: normal + codeql/bearer if enabled+available
- Truncate findings to 3k chars; never dump full SARIF.

Exhaustive switch on `SecurityPolicy` with `never` default.

- [ ] MCP `security_scan` + commit `feat: security scan orchestrator (semgrep-first)`

---

### Task 12: `prepare_context` orchestrator

**Files:**
- Create: `src/orchestrator/prepareContext.ts`
- Modify: `src/mcp/tools.ts`
- Test: `tests/prepare-context.test.ts`

**Interfaces:**
- `prepareContext(config, { workspacePath, task, includeMemory?: boolean, includeGraph?: boolean }): string`
- Assembly order per spec priority; hard cap ~8k chars; sections tagged.
- Must **not** include full OWASP or full memory dumps.
- Graph: call existing `graphQuery` only if graphify available and `includeGraph`.
- Memory: only if `includeMemory && config.memory.enabled`.

- [ ] MCP `prepare_context` + commit `feat: prepare_context orchestrator`

---

### Task 13: `finalize_task` workflow

**Files:**
- Create: `src/orchestrator/finalizeTask.ts`
- Create: `src/validation/build.ts` — detect `package.json` scripts.build; run with max attempts from config; extract error lines only
- Modify: `src/mcp/tools.ts`
- Test: `tests/finalize-task.test.ts`

**Interfaces:**
- `finalizeTask(config, args): string` steps: git summary → optional quality → optional security → optional review → update handoff fields if provided → cleanup only `tempSessionDir` if `sessionId` given → return checklist report.

- [ ] MCP `finalize_task` + commit `feat: finalize_task end-of-task workflow`

---

### Task 14: Cursor rule + editor docs + skills stub

**Files:**
- Modify: `examples/cursor-rule.mdc`
- Modify: `docs/CONNECT-EDITORS.md`
- Modify: `docs/ARCHITECTURE.md`
- Create: `skills/README.md` — Anthropic-style skill folders for future task skills (empty template only)
- Create: `skills/_template/SKILL.md`

Update Cursor rule to: register/get context → `prepare_context` for tasks → `discipline_rules` when implementing → `finalize_task` when done; do not load all providers into every turn.

- [ ] Commit `docs: wire editor guidance to provider facade tools`

---

### Task 15: Full verification

- [ ] Run `npm test`
- [ ] Run `npm run build`
- [ ] Run doctor via `npm run doctor` or MCP
- [ ] Run `scripts/install-providers.ps1 -SkipHeavy` if not yet run
- [ ] Confirm `get_project_context` still excludes memory/OWASP dumps (spot-check test)
- [ ] Update design status line to `Implemented (phased)` in the spec file
- [ ] Final commit: `chore: verify provider MCP facade P0-P5`

---

## Spec coverage checklist

| Spec area | Task(s) |
|-----------|---------|
| One MCP facade | 4, 6–13 |
| Config toggles | 1 |
| Compression XOR | 2 |
| Provider registry / installs | 3, 5 |
| Graphify | existing + doctor |
| Claude-Mem selective | 10 |
| Ponytail | 6 |
| Caveman / Context Mode | 2, 5, 6 |
| OpenCodeReview + reviews/ | 9 |
| Quality detect Prettier/ESLint/Biome | 8 |
| OWASP refs | 5, 7 |
| Security light/normal/deep | 11 |
| prepare_context priority | 12 |
| finalize + maxBuildAttempts | 13 |
| Editor docs / skills architecture | 14 |
| ACS SoT unchanged | all (explicit non-merge) |

## Placeholder / consistency self-review

- No TBD steps; install script soft-fails for heavy tools.
- Claude-Mem port default may need adjustment at Task 10 after reading local worker docs — capture actual URL in `claudeMem.ts` constant and `docs/PROVIDERS.md` in that same task.
- Anthropics/skills: Task 14 template only (reference architecture), not cloning entire anthropics/skills repo.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-20-provider-mcp-facade.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — execute tasks in this session with checkpoints  

Which approach?
