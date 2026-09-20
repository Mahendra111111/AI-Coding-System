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

## Context assembly

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
