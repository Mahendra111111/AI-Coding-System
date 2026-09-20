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

