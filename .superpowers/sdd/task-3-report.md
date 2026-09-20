# Task 3 Report: Provider Registry + Paths + Which Helper

## Status
**DONE** — TDD RED→GREEN, committed.

## Commit
- `f2a89cb` — `feat: add provider registry and path helpers`

## Files Created / Modified

| File | Action | Purpose |
|------|--------|---------|
| `providers/registry.json` | Created | 14 provider entries with id, role, install, cli, checkout |
| `src/providers/types.ts` | Created | `ProviderRole`, `ProviderEntry`, `ProviderRegistry` types |
| `src/providers/registry.ts` | Created | `providerRegistryPath`, `loadProviderRegistry` |
| `src/providers/which.ts` | Created | `cliAvailable` — cross-cutting CLI detection (Windows-safe) |
| `src/core/paths.ts` | Modified | Added `providersDir`, `reviewsDir`, `tempSessionDir` |
| `tests/provider-registry.test.ts` | Created | Registry load, path helpers, cliAvailable smoke test |

## Test Summary

```
tests/provider-registry.test.ts  3 passed (3)
Full suite                       13 passed (13) across 5 files
npm run build                    pass
```

### Cases Covered
1. **Registry load** — `loadProviderRegistry` returns all 14 expected provider ids in order
2. **Path helpers** — `providersDir`, `reviewsDir`, `tempSessionDir` resolve under systemRoot/projects
3. **CLI detection** — `cliAvailable("node")` returns boolean without throwing

## Implementation Notes
- `loadProviderRegistry` reads `providers/registry.json` via `join(providersDir(config), "registry.json")`
- `cliAvailable` tries `--help` first, then `where.exe` on Windows (same pattern as existing `isGraphifyAvailable`)
- Checkout paths in registry are relative to `systemRoot` (e.g. `providers/skills/ponytail`) — resolved in Task 4 status checks
- Imports at file top per workspace rule; no doctor/MCP changes (Task 4 scope)

## Concerns
- None blocking. Registry JSON is not schema-validated at load time (zod validation could be added in Task 4 if desired).
- `npm`/`node` not on default PATH in this shell; tests run successfully with `C:\Program Files\nodejs` prepended.

## Next Steps (Task 4)
- Implement `getAllProviderStatuses` using `cliAvailable`, checkout `existsSync`, config enabled flags
- Wire doctor + MCP `provider_status` tool
