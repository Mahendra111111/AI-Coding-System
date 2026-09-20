# Task 10 Report: Claude-Mem selective memory tools

## Status

DONE

## Commit

- `f67ad5e feat: selective claude-mem memory tools (non-SoT)`

## Implementation

- Added `src/providers/claudeMem.ts`.
  - Reads `CLAUDE_MEM_WORKER_URL`, defaulting to `http://127.0.0.1:37777`.
  - `memorySearch(config, query, limit=10)` calls `GET /api/search` with compact observation-index parameters.
  - `memoryGet(config, ids)` calls `POST /api/observations/batch` with only the requested IDs.
  - Both operations return a clear disabled message without making HTTP requests when `config.memory.enabled` is false.
  - Worker/network/HTTP failures return an actionable message containing `npx claude-mem install --provider host` and URL override guidance.
  - Requests use a 10-second timeout.
- Added `memory_search` and `memory_get` MCP tools in `src/mcp/tools.ts`.
  - Search limits are constrained to 1–100.
  - Observation IDs must be positive integers.
  - Tool descriptions explicitly preserve ACS as the source of truth.
- Confirmed no Claude-Mem provider calls or imports exist in `buildProjectContext` or `src/context`.
- Updated `docs/PROVIDERS.md` with current Claude-Mem per-user port behavior and `CLAUDE_MEM_WORKER_URL` guidance.

## TDD and validation

1. Added `tests/claude-mem.test.ts` before the provider implementation.
2. Confirmed the test suite initially failed because `src/providers/claudeMem.ts` did not exist.
3. Implemented the provider and MCP facade.
4. Targeted test: 1 file passed, 4 tests passed.
5. Full test suite: 11 files passed, 41 tests passed.
6. TypeScript build: passed (`npm run build`).
7. IDE diagnostics reported two stale module-resolution errors for pre-existing `caveman.js` and `ponytail.js` imports in `src/mcp/tools.ts`; `tsc` completed successfully, so these were not compiler failures introduced by this task.

## API verification

Current Claude-Mem documentation identifies:

- `GET /api/search`
- `POST /api/observations/batch`
- a per-user default port of `37700 + (uid % 100)`, stored in `~/.claude-mem/settings.json`

The task-required ACS fallback remains `http://127.0.0.1:37777`; the provider supports the actual active URL through `CLAUDE_MEM_WORKER_URL`.

## Concerns

None blocking. Users of current Claude-Mem releases may need to set `CLAUDE_MEM_WORKER_URL` because the task-required fallback can differ from Claude-Mem's active per-user port.
