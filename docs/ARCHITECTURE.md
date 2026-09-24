# Architecture

## Purpose

Cross-editor shared project context via a **local MCP server**. Editors do not own the durable state; they query and update it through tools.

## Layout

```
C:\AI-Coding-System\
  src\                 TypeScript source
  dist\                Built MCP entry (node dist/index.js)
  config\system.json   System config
  templates\           Seed Markdown for new projects
  skills\              ACS task skills (Anthropic-style folders)
  projects\<id>\       Per-project brain
    project.json
    context\
      PROJECT_STATE.md
      HANDOFF.md
      DECISIONS.md
      CONSTRAINTS.md
      ARCHITECTURE.md
  state\registry.json  Index of projects
```

Source code for user apps remains on **D:** (or other paths). Only metadata and compact Markdown live under `projects\`.

## Identity

```
workspace path
  -> git remote? normalize -> remote:<host>/<path>
  -> else path:<canonical lowercase path>
  -> SHA-256 -> 20 hex chars = projectId
```

Same remote after a folder move → same `projectId`; `workspacePath` is updated.

## One MCP facade

Editors configure **only** `ai-coding-system`. External providers (Claude-Mem, Graphify, Ponytail, OpenCodeReview, Semgrep, etc.) are thin adapters under `src/providers/` — agents call ACS tools; ACS invokes providers on demand.

| Group | Tools |
|-------|-------|
| Project | `register_project`, `get_project_context`, `get_handoff`, `update_handoff`, `update_project_state`, `list_projects` |
| Orchestrate | `prepare_context`, `finalize_task` |
| Decide | `decide_tools`, `decide_gate`, `reticle_guidance`, `seo_guidance` |
| Graph | `graph_index`, `graph_query`, `graph_explain` |
| Memory | `memory_search`, `memory_timeline`, `memory_get` |
| Quality | `quality_detect`, `quality_check` |
| Security | `security_scan`, `security_refs` |
| Review | `review_diff`, `review_scan` |
| Policy | `discipline_rules`, `compression_guidance` |
| Meta | `doctor`, `provider_status`, `get_git_summary` |

`decide_tools` uses the local Von System One server to pick the next ACS tool (or Reticle peer verification). Reticle itself remains a **peer MCP**; ACS does not proxy `reticle_*` tools. `seo_guidance` steers agents to install [next-seo](https://github.com/garmeeh/next-seo) in the **target Next.js app** and ship metadata + JSON-LD with content using user keywords.

`get_project_context` does **not** auto-merge Claude-Mem or full provider dumps. Memory and graph are opt-in via `memory_*` or `prepare_context` flags.

## Context orchestrator

`prepare_context` assembles task-scoped context in priority order: task → acceptance criteria → modified files → build errors → security findings → architecture → constraints → handoff. Stops when sufficient. Optional selective memory and graph relationships; never full-repo or full-database dumps.

`finalize_task` runs the end-of-task checklist: git summary, build validation, optional quality/security/review checks, handoff update, and managed session-temp cleanup.

## Context assembly (legacy path)

`get_project_context` builds a compact tagged document:

1. PROJECT metadata
2. TECHNOLOGY / ARCHITECTURE
3. CURRENT work + next action
4. HANDOFF
5. RECENT / CONSTRAINTS / DECISIONS
6. VALIDATION / KNOWN_ISSUES
7. GIT summary (optional)

No full-repo dumps. No chat transcripts.

## MCP surface

`src/mcp/tools.ts` registers tools on `@modelcontextprotocol/sdk` `McpServer` over stdio (`src/index.ts`).

Optional Graphify tools are registered when `config.graphify.enabled` is true; they degrade with an install hint if the CLI is missing.

## Safety

- Idempotent `register_project`
- Atomic file writes for state/handoff
- Cleanup of user source files is **not** performed by this MCP
- Telemetry off by default
