# Task 8 Report: Quality detect/check

## Status
**COMPLETE** — TDD RED→GREEN, committed.

## Commit
- `b9c096e` — `feat: quality detect and check for prettier eslint biome`

## Files Created / Modified
| File | Purpose |
|------|---------|
| `src/providers/quality.ts` | `detectQualityStack`, `runQualityCheck` (4k truncate, conflict skip) |
| `src/mcp/tools.ts` | MCP tools `quality_detect`, `quality_check` |
| `tests/quality-detect.test.ts` | 9 tests with temp fixture dirs |

## Test Summary
```
tests/quality-detect.test.ts  9 passed (9)
Full suite                   33 passed (33)
npm run build                OK
```

## Implementation Notes
- Detects `biome.json`, `.prettierrc*`, `eslint.config.*`, `package.json` deps/scripts
- Conflict when Prettier+Biome or ESLint+Biome; `runQualityCheck` skips auto-run on conflict
- Biome-only runs `biome check`; Prettier+ESLint runs both via `npx`

## Next Steps (Task 9+)
- OpenCodeReview adapter (`review_diff`, `review_scan`)
