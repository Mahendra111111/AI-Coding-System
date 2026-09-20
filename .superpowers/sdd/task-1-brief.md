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

