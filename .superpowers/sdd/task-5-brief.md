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

