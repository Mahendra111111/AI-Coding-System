# Task 6 Report: Ponytail discipline + Caveman compression guidance

## Status
**COMPLETE** — TDD RED→GREEN, committed.

## Commit
- `adb605d` — `feat: expose ponytail discipline and compression guidance tools`

## Files Created / Modified
| File | Purpose |
|------|---------|
| `src/providers/ponytail.ts` | `getDisciplineRules`: 7-rung YAGNI ladder + safety carve-outs; checkout path when present |
| `src/providers/caveman.ts` | `getCavemanGuidance`: terse guidance when caveman active; context-mode/off messages otherwise |
| `src/mcp/tools.ts` | MCP tools `discipline_rules`, `compression_guidance` |
| `providers/skills/README.md` | Ponytail Cursor hooks installer instructions |
| `tests/discipline-rules.test.ts` | 4 tests: ladder content, checkout hint, context-mode, caveman guidance |
| `.gitignore` | Allow `providers/skills/README.md` while ignoring skill checkouts |

## Test Summary
```
tests/discipline-rules.test.ts  4 passed (4)
Full suite                     19 passed (19)
npm run build                  OK
```

### Cases Covered
1. **discipline_rules non-empty** — 7 numbered rungs, YAGNI, security/a11y/validation/error-handling carve-outs
2. **checkout path** — appends install hint when `providers/skills/ponytail` exists
3. **context-mode default** — guidance states context-mode active, caveman off
4. **caveman active** — terse-output guidance when `contextMode` off and `caveman` on

## Implementation Notes
- Ponytail copy aligned with upstream README ladder + safety boundaries
- Caveman uses `activeCompressionProvider` from compression.ts (context-mode wins on overlap)
- `.gitignore` negation `providers/skills/*` + `!providers/skills/README.md` so docs commit without checkouts

## Concerns
- Ponytail checkout not present in this workspace; `discipline_rules` returns clone hint until `install-providers.ps1` runs
- Checkout-path test is conditional (passes whether or not checkout exists)

## Next Steps (Task 7+)
- `security_refs` OWASP topic tool
- Wire `discipline_rules` into orchestrator / Cursor rule examples
