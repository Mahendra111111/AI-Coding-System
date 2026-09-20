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

Manual MCP entry:

```json
{
  "mcpServers": {
    "ai-coding-system": {
      "command": "node",
      "args": ["C:\\AI-Coding-System\\dist\\index.js"]
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

| Tool | Purpose |
|------|---------|
| `register_project` | Create/load project brain (idempotent) |
| `get_project_context` | Compact durable context |
| `get_handoff` | Latest handoff only |
| `update_handoff` | Persist continuation state |
| `update_project_state` | Patch PROJECT_STATE / decisions / constraints |
| `list_projects` | List registered projects |
| `get_git_summary` | Branch / dirty files / recent commits |
| `doctor` | Health checks |
| `graph_query` / `graph_explain` / `graph_index` | Optional Graphify (if installed) |

## Project identity

1. Normalized git remote URL (preferred)
2. Else canonical absolute workspace path
3. SHA-256 → 20-char hex `projectId`

Moving a folder with the same remote does **not** create a duplicate brain.

## Develop

```powershell
npm install
npm run build
npm test
npm start   # stdio MCP server
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
