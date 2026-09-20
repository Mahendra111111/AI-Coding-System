# T14
BASE: 8a7e3ff3c8ed72d957ca462a53f58117afd7b4fe
HEAD: 558234bf069214f601c30fbd1602fcdc27543821
## Commits
558234b docs: wire editor guidance to provider facade tools
## Stat
 .superpowers/sdd/task-14-report.md | 21 +++++++++++++++++++++
 docs/ARCHITECTURE.md               | 27 ++++++++++++++++++++++++++-
 docs/CONNECT-EDITORS.md            | 17 ++++++++++++++++-
 examples/cursor-rule.mdc           | 28 ++++++++++++++++++++++------
 skills/README.md                   | 29 +++++++++++++++++++++++++++++
 skills/_template/SKILL.md          | 29 +++++++++++++++++++++++++++++
 6 files changed, 143 insertions(+), 8 deletions(-)
## Diff
diff --git a/.superpowers/sdd/task-14-report.md b/.superpowers/sdd/task-14-report.md
new file mode 100644
index 0000000..8e79497
--- /dev/null
+++ b/.superpowers/sdd/task-14-report.md
@@ -0,0 +1,21 @@
+# Task 14 Report: Cursor rule + editor docs + skills stub
+
+## Status
+
+DONE
+
+## Implementation
+
+- Updated `examples/cursor-rule.mdc` with facade workflow: register/get context ÔåÆ `prepare_context` ÔåÆ `discipline_rules` ÔåÆ `finalize_task`; token discipline (no all-providers-every-turn).
+- Updated `docs/CONNECT-EDITORS.md` with one-MCP facade note, recommended workflow table, and verify steps for new tools.
+- Updated `docs/ARCHITECTURE.md` with facade tool groups, orchestrator (`prepare_context` / `finalize_task`), and `skills/` layout.
+- Created `skills/README.md` and `skills/_template/SKILL.md` (Anthropic-style stub for future ACS task skills).
+
+## Validation
+
+- Docs-only change; no tests required.
+- Files match task-14-brief scope.
+
+## Commit
+
+- `docs: wire editor guidance to provider facade tools`
diff --git a/docs/ARCHITECTURE.md b/docs/ARCHITECTURE.md
index 1d4d707..1e13cc4 100644
--- a/docs/ARCHITECTURE.md
+++ b/docs/ARCHITECTURE.md
@@ -12,6 +12,7 @@ C:\AI-Coding-System\
   dist\                Built MCP entry (node dist/index.js)
   config\system.json   System config
   templates\           Seed Markdown for new projects
+  skills\              ACS task skills (Anthropic-style folders)
   projects\<id>\       Per-project brain
     project.json
     context\
@@ -36,7 +37,31 @@ workspace path
 
 Same remote after a folder move ÔåÆ same `projectId`; `workspacePath` is updated.
 
-## Context assembly
+## One MCP facade
+
+Editors configure **only** `ai-coding-system`. External providers (Claude-Mem, Graphify, Ponytail, OpenCodeReview, Semgrep, etc.) are thin adapters under `src/providers/` ÔÇö agents call ACS tools; ACS invokes providers on demand.
+
+| Group | Tools |
+|-------|-------|
+| Project | `register_project`, `get_project_context`, `get_handoff`, `update_handoff`, `update_project_state`, `list_projects` |
+| Orchestrate | `prepare_context`, `finalize_task` |
+| Graph | `graph_index`, `graph_query`, `graph_explain` |
+| Memory | `memory_search`, `memory_timeline`, `memory_get` |
+| Quality | `quality_detect`, `quality_check` |
+| Security | `security_scan`, `security_refs` |
+| Review | `review_diff`, `review_scan` |
+| Policy | `discipline_rules`, `compression_guidance` |
+| Meta | `doctor`, `provider_status`, `get_git_summary` |
+
+`get_project_context` does **not** auto-merge Claude-Mem or full provider dumps. Memory and graph are opt-in via `memory_*` or `prepare_context` flags.
+
+## Context orchestrator
+
+`prepare_context` assembles task-scoped context in priority order: task ÔåÆ acceptance criteria ÔåÆ modified files ÔåÆ build errors ÔåÆ security findings ÔåÆ architecture ÔåÆ constraints ÔåÆ handoff. Stops when sufficient. Optional selective memory and graph relationships; never full-repo or full-database dumps.
+
+`finalize_task` runs the end-of-task checklist: git summary, build validation, optional quality/security/review checks, handoff update, and managed session-temp cleanup.
+
+## Context assembly (legacy path)
 
 `get_project_context` builds a compact tagged document:
 
diff --git a/docs/CONNECT-EDITORS.md b/docs/CONNECT-EDITORS.md
index 59147b1..aeeb9eb 100644
--- a/docs/CONNECT-EDITORS.md
+++ b/docs/CONNECT-EDITORS.md
@@ -4,6 +4,8 @@ Server entry (after `npm run build`):
 
 `C:\AI-Coding-System\dist\index.js`
 
+Editors configure **one MCP server** (`ai-coding-system`). Upstream tools (Claude-Mem, Graphify, Ponytail, OpenCodeReview, Semgrep, etc.) are **not** separate MCP entries ÔÇö ACS invokes them through facade tools when you call orchestrated endpoints.
+
 ## Cursor
 
 **User-global (recommended):** `%USERPROFILE%\.cursor\mcp.json`
@@ -58,12 +60,25 @@ Add the same stdio MCP server in AntigravityÔÇÖs MCP / tools settings. Prefer th
 
 Any editor that supports **MCP stdio servers** can use the same command/args. Place the server definition in that productÔÇÖs MCP config file.
 
+## Recommended agent workflow
+
+| Phase | MCP tools |
+|-------|-----------|
+| Session start | `register_project`, `get_project_context` (or `get_handoff` for fast switch) |
+| Task planning | `prepare_context` ÔÇö task-scoped assembly; opt in to memory/graph only when needed |
+| Implementation | `discipline_rules`, `security_refs`; targeted `quality_check` / `security_scan` / `review_diff` |
+| Task complete | `finalize_task` ÔÇö git summary, optional checks, handoff update, session cleanup |
+
+Do **not** wire Claude-Mem, Graphify, or other providers as additional MCP servers. Do **not** call memory, graph, or scan tools on every turn.
+
 ## Verify
 
 In the editor chat:
 
 1. Ask: ÔÇ£Call the `doctor` MCP tool from ai-coding-systemÔÇØ
 2. Ask: ÔÇ£Register this workspace with `register_project`ÔÇØ
-3. Ask: ÔÇ£Call `get_project_context` for this workspaceÔÇØ
+3. Ask: ÔÇ£Call `prepare_context` for this workspace with task: verify MCP wiringÔÇØ
+4. Ask: ÔÇ£Call `discipline_rules`ÔÇØ
+5. Ask: ÔÇ£Call `finalize_task` for this workspace with currentTask: verify wiringÔÇØ
 
 If tools do not appear, confirm `dist\index.js` exists and Node is on PATH for GUI apps (sign out/in after installing Node).
diff --git a/examples/cursor-rule.mdc b/examples/cursor-rule.mdc
index baebceb..e22b955 100644
--- a/examples/cursor-rule.mdc
+++ b/examples/cursor-rule.mdc
@@ -1,14 +1,30 @@
 ---
-description: Use AI Coding System MCP for shared project context
+description: Use AI Coding System MCP for shared project context and task workflow
 alwaysApply: true
 ---
 
 # AI Coding System
 
-Before substantial coding in this workspace:
+Connect **one** MCP server: `ai-coding-system` ÔåÆ `node C:\AI-Coding-System\dist\index.js`. Do not add upstream providers (Claude-Mem, Graphify, Ponytail, etc.) as separate MCP entries ÔÇö ACS exposes them through facade tools.
 
-1. Call MCP tool `get_project_context` (or `register_project`) with the workspace path.
-2. Follow constraints and handoff next actions.
-3. After meaningful completed work, call `update_handoff` with current task, completed items, files changed, remaining work, and any important decision.
+## Session start
 
-Do not ask the user to re-explain architecture already present in project context.
+1. Call `register_project` (first time) or `get_project_context` with the workspace path.
+2. Follow constraints, handoff next actions, and decisions already stored in project context.
+3. Do not ask the user to re-explain architecture already present in context.
+
+## Per task
+
+1. Call `prepare_context` with the workspace path and a clear task description (acceptance criteria). Enable `includeMemory` or `includeGraph` only when the task needs them ÔÇö defaults are off.
+2. While implementing, call `discipline_rules` for the compact YAGNI ladder and safety carve-outs. Use `security_refs` for topic-scoped OWASP excerpts when security matters.
+3. Use targeted tools (`quality_check`, `security_scan`, `review_diff`) only when relevant ÔÇö not on every edit.
+
+## Task complete
+
+Call `finalize_task` with workspace path, handoff fields (`currentTask`, `completed`, `filesChanged`, `remaining`), and optional checks (`qualityCheck`, `securityScan`, `review`) only when warranted.
+
+## Token discipline
+
+- Do not load all providers into every turn.
+- Do not call `memory_*`, graph tools, or full scans unless the current task requires them.
+- Prefer `get_handoff` for fast editor switches instead of re-fetching full context.
diff --git a/skills/README.md b/skills/README.md
new file mode 100644
index 0000000..135ed10
--- /dev/null
+++ b/skills/README.md
@@ -0,0 +1,29 @@
+# ACS task skills
+
+Anthropic-style skill folders for task-specific agent behavior. Each skill is a directory with a `SKILL.md` file (YAML frontmatter + markdown body).
+
+## Layout
+
+```
+skills/
+  README.md           # this file
+  _template/SKILL.md  # copy to start a new skill
+  <skill-name>/       # one folder per skill (future)
+    SKILL.md
+    scripts/          # optional helpers
+    references/       # optional docs
+```
+
+## Conventions
+
+- **Frontmatter:** `name` (kebab-case) and `description` (when to use the skill).
+- **Scope:** ACS-specific workflows (finalize checklist, provider wiring, review policy) ÔÇö not duplicate upstream provider skills under `providers/skills/`.
+- **Discovery:** Skills here are referenced by ACS orchestration and editor rules; they are not auto-loaded into every agent turn.
+
+## Adding a skill
+
+1. Copy `_template/` to `skills/<skill-name>/`.
+2. Edit `SKILL.md` frontmatter and body.
+3. Wire the skill from orchestrator or docs when the workflow is ready.
+
+See [docs/superpowers/specs/2026-09-20-provider-mcp-facade-design.md](../docs/superpowers/specs/2026-09-20-provider-mcp-facade-design.md) for how task skills fit the provider facade.
diff --git a/skills/_template/SKILL.md b/skills/_template/SKILL.md
new file mode 100644
index 0000000..89a7cb8
--- /dev/null
+++ b/skills/_template/SKILL.md
@@ -0,0 +1,29 @@
+---
+name: skill-name
+description: >-
+  One-line trigger: when the agent should load this skill (specific task,
+  workflow, or domain).
+---
+
+# Skill title
+
+Brief purpose statement.
+
+## When to use
+
+- Scenario 1
+- Scenario 2
+
+## Workflow
+
+1. Step one
+2. Step two
+3. Step three
+
+## MCP tools
+
+List relevant `ai-coding-system` tools and when to call them. Prefer targeted facade tools over loading all providers.
+
+## Output
+
+Expected format or checklist for the agent's deliverable.
