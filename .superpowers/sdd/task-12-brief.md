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

