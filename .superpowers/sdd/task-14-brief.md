### Task 14: Cursor rule + editor docs + skills stub

**Files:**
- Modify: `examples/cursor-rule.mdc`
- Modify: `docs/CONNECT-EDITORS.md`
- Modify: `docs/ARCHITECTURE.md`
- Create: `skills/README.md` — Anthropic-style skill folders for future task skills (empty template only)
- Create: `skills/_template/SKILL.md`

Update Cursor rule to: register/get context → `prepare_context` for tasks → `discipline_rules` when implementing → `finalize_task` when done; do not load all providers into every turn.

- [ ] Commit `docs: wire editor guidance to provider facade tools`

---

