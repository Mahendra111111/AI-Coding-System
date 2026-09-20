# Task 2 Report: Compression XOR Policy

## Status
**COMPLETE** — TDD RED→GREEN, committed.

## Commit
- `f273688` — `feat: enforce contextMode XOR caveman compression policy`

## Files Created
| File | Purpose |
|------|---------|
| `src/providers/compression.ts` | XOR policy: `activeCompressionProvider`, `assertCompressionPolicy` |
| `tests/compression.test.ts` | 3 tests covering default, caveman-only, and overlap cases |

## Test Summary
```
tests/compression.test.ts  3 passed (3)
Full suite                 10 passed (10) across 4 files
```

### Cases Covered
1. **context-mode preferred** — `contextMode.enabled=true`, `caveman.enabled=false` → active `"context-mode"`, policy ok
2. **caveman fallback** — `contextMode.enabled=false`, `caveman.enabled=true` → active `"caveman"`
3. **overlap warning** — both enabled → `assertCompressionPolicy` returns `ok: false` with "overlap" in detail; active path still `"context-mode"`

## Implementation Notes
- `activeCompressionProvider` checks `contextMode` first (priority), then `caveman`, else `"none"`
- `assertCompressionPolicy` rejects dual-enable with descriptive overlap message; on valid config returns `active compression: <provider>`
- Imports at file top per workspace rule; consumes `SystemConfig` from `src/core/config.ts`

## Concerns
- None blocking. Overlap is warned but does not throw — callers must check `assertCompressionPolicy().ok` if they want hard enforcement.
- `npm`/`node` not on default PATH in this shell; tests run successfully with `C:\Program Files\nodejs` prepended.

## Next Steps (Task 3+)
- Wire `assertCompressionPolicy` into config load or doctor CLI for runtime validation
- Provider facade can call `activeCompressionProvider` to select compression backend
