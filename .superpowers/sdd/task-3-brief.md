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

