# Task 4 Report: Provider Status, Doctor, and MCP

## Status
**DONE** — implemented with TDD and committed.

## Commit
- `4b55ae9` — `feat: provider status surface in doctor and MCP`

## Files Created / Modified
- `src/providers/status.ts` — reports config state, local availability, install guidance, and compression policy for all registry providers.
- `src/doctor.ts` — includes provider rows while keeping optional provider failures out of overall health.
- `src/mcp/tools.ts` — registers `provider_status`, returning formatted JSON.
- `tests/provider-status.test.ts` — verifies all 14 providers and compression-overlap reporting.

## Test Summary
```text
tests/provider-status.test.ts  2 passed (2)
Full suite                     15 passed (15) across 6 files
npm run build                  pass
IDE lint diagnostics           none
```

## Validation
- Confirmed the new test failed before implementation because `src/providers/status.ts` did not exist.
- Expanded doctor smoke output listed all provider rows and degraded missing optional providers to warnings.
- Compression overlap is surfaced on both compression-provider rows via `assertCompressionPolicy`.

## Concerns
- `npm`, Node, and Git are not on the default agent-shell PATH; validation used their installed absolute locations.
- The doctor smoke command exited nonzero only because Git was absent from that shell PATH; missing optional providers did not determine overall health.
- Providers with neither a CLI nor checkout probe (`claude-mem`, `context-mode`) report availability as unverified/missing with their install hint.
