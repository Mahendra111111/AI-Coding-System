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

