# ACS task skills

Anthropic-style skill folders for task-specific agent behavior. Each skill is a directory with a `SKILL.md` file (YAML frontmatter + markdown body).

This is the **Task 14 template layout**, not a full clone of `anthropics/skills`. Discover via MCP:

- `provider_status` → `anthropic-skills`
- `list_acs_skills`

## Layout

```
skills/
  README.md           # this file
  _template/SKILL.md  # copy to start a new skill
  <skill-name>/       # one folder per skill (future)
    SKILL.md
    scripts/          # optional helpers
    references/       # optional docs
```

## Conventions

- **Frontmatter:** `name` (kebab-case) and `description` (when to use the skill).
- **Scope:** ACS-specific workflows (finalize checklist, provider wiring, review policy) — not duplicate upstream provider skills under `providers/skills/`.
- **Discovery:** Skills here are referenced by ACS orchestration and editor rules; they are not auto-loaded into every agent turn.

## Adding a skill

1. Copy `_template/` to `skills/<skill-name>/`.
2. Edit `SKILL.md` frontmatter and body.
3. Wire the skill from orchestrator or docs when the workflow is ready.

See [docs/superpowers/specs/2026-09-20-provider-mcp-facade-design.md](../docs/superpowers/specs/2026-09-20-provider-mcp-facade-design.md) for how task skills fit the provider facade.
