# AI Coding System

Local **MCP server** that gives AI coding editors shared, durable project context.

- Source projects stay on **D:** (or anywhere)
- Project “brain” lives under **C:\AI-Coding-System\projects\<id>**
- Any MCP-capable editor (Cursor, Claude Code, Antigravity, etc.) connects to the same server

## Quick install (Windows)

```powershell
cd C:\AI-Coding-System
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

Then restart Cursor (or reload MCP). The installer merges into `%USERPROFILE%\.cursor\mcp.json` (with backup).

If `node` / `npm` are “not recognized” in a terminal (PATH not refreshed), build with:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build.ps1
```

Or use full paths:

```powershell
& "C:\Program Files\nodejs\npm.cmd" run build
```

Manual MCP entry (full `node.exe` path — required when PATH is incomplete for GUI apps):

```json
{
  "mcpServers": {
    "ai-coding-system": {
      "command": "C:\\Program Files\\nodejs\\node.exe",
      "args": ["C:\\AI-Coding-System\\dist\\index.js"],
      "env": {
        "PATH": "C:\\Program Files\\nodejs;C:\\Windows\\System32;C:\\Program Files\\Git\\cmd"
      }
    }
  }
}
```

## How agents should use it

1. Call `register_project` or `get_project_context` with the workspace path
2. Code using the compact context (architecture, handoff, constraints, decisions)
3. After meaningful work, call `update_handoff` (and optionally `update_project_state`)

Optional thin Cursor rule: [examples/cursor-rule.mdc](examples/cursor-rule.mdc)

## MCP tools

**24 tools** on one server (`ai-coding-system`):

| Group | Tools |
|-------|--------|
| Project | `register_project`, `get_project_context`, `get_handoff`, `update_handoff`, `update_project_state`, `list_projects` |
| Orchestrate | `prepare_context`, `finalize_task` |
| Graph | `graph_index`, `graph_query`, `graph_explain` |
| Memory | `memory_search`, `memory_get` |
| Discipline | `discipline_rules`, `compression_guidance` |
| Quality | `quality_detect`, `quality_check` |
| Review | `review_diff`, `review_scan` |
| Security | `security_refs`, `security_scan` |
| Meta | `doctor`, `provider_status`, `get_git_summary` |

If Cursor shows only ~11 tools, rebuild (`scripts\build.ps1`) and **reload MCP**.

## Project identity

1. Normalized git remote URL (preferred)
2. Else canonical absolute workspace path
3. SHA-256 → 20-char hex `projectId`

Moving a folder with the same remote does **not** create a duplicate brain.

## Develop

```powershell
# Prefer when PATH has node/npm:
npm install
npm run build
npm test

# If npm/node are "not recognized":
powershell -ExecutionPolicy Bypass -File .\scripts\build.ps1
```

## Docs

- [docs/CONNECT-EDITORS.md](docs/CONNECT-EDITORS.md)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## Optional: Graphify

```powershell
winget install astral-sh.uv
uv tool install graphifyy
```

Then use `graph_index` / `graph_query` MCP tools.
