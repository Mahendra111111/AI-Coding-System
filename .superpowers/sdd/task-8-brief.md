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

