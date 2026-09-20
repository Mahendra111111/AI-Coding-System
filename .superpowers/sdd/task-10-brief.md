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

