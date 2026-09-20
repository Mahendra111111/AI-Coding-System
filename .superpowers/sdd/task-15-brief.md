### Task 15: Full verification

- [ ] Run `npm test`
- [ ] Run `npm run build`
- [ ] Run doctor via `npm run doctor` or MCP
- [ ] Run `scripts/install-providers.ps1 -SkipHeavy` if not yet run
- [ ] Confirm `get_project_context` still excludes memory/OWASP dumps (spot-check test)
- [ ] Update design status line to `Implemented (phased)` in the spec file
- [ ] Final commit: `chore: verify provider MCP facade P0-P5`

---

## Spec coverage checklist

| Spec area | Task(s) |
|-----------|---------|
| One MCP facade | 4, 6–13 |
| Config toggles | 1 |
| Compression XOR | 2 |
| Provider registry / installs | 3, 5 |
| Graphify | existing + doctor |
| Claude-Mem selective | 10 |
| Ponytail | 6 |
| Caveman / Context Mode | 2, 5, 6 |
| OpenCodeReview + reviews/ | 9 |
| Quality detect Prettier/ESLint/Biome | 8 |
| OWASP refs | 5, 7 |
| Security light/normal/deep | 11 |
| prepare_context priority | 12 |
| finalize + maxBuildAttempts | 13 |
| Editor docs / skills architecture | 14 |
| ACS SoT unchanged | all (explicit non-merge) |

## Placeholder / consistency self-review

- No TBD steps; install script soft-fails for heavy tools.
- Claude-Mem port default may need adjustment at Task 10 after reading local worker docs — capture actual URL in `claudeMem.ts` constant and `docs/PROVIDERS.md` in that same task.
- Anthropics/skills: Task 14 template only (reference architecture), not cloning entire anthropics/skills repo.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-20-provider-mcp-facade.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — execute tasks in this session with checkpoints  

Which approach?
