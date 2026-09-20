# Task 14 Report: Cursor rule + editor docs + skills stub

## Status

DONE

## Implementation

- Updated `examples/cursor-rule.mdc` with facade workflow: register/get context → `prepare_context` → `discipline_rules` → `finalize_task`; token discipline (no all-providers-every-turn).
- Updated `docs/CONNECT-EDITORS.md` with one-MCP facade note, recommended workflow table, and verify steps for new tools.
- Updated `docs/ARCHITECTURE.md` with facade tool groups, orchestrator (`prepare_context` / `finalize_task`), and `skills/` layout.
- Created `skills/README.md` and `skills/_template/SKILL.md` (Anthropic-style stub for future ACS task skills).

## Validation

- Docs-only change; no tests required.
- Files match task-14-brief scope.

## Commit

- `docs: wire editor guidance to provider facade tools`
