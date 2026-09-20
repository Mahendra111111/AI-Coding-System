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

