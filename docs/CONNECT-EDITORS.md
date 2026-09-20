# Connect editors to AI Coding System MCP

Server entry (after `npm run build`):

`C:\AI-Coding-System\dist\index.js`

Editors configure **one project-brain MCP server** (`ai-coding-system`) for state, handoff, and orchestration. Upstream tools (Claude-Mem, Graphify, Ponytail, OpenCodeReview, Semgrep, etc.) are **not** separate MCP entries — ACS invokes them through facade tools when you call orchestrated endpoints.

**Temporary exception:** Context Mode may optionally be configured as a **peer MCP** for tool-output sandboxing until ACS proxies it. Graphify and Claude-Mem still go through ACS facade tools only.

## Cursor

**User-global (recommended):** `%USERPROFILE%\.cursor\mcp.json`

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

Or run `install.ps1` which merges this entry (backs up existing file).

**Project-local:** create `.cursor/mcp.json` in a workspace with the same snippet.

Restart Cursor or reload MCP servers after changing config.

Optional rule: copy [examples/cursor-rule.mdc](../examples/cursor-rule.mdc) into `.cursor/rules/`.

## Claude Code

Add to Claude Code MCP settings (CLI or config file — names vary by version):

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

Typical locations to check:

- `%USERPROFILE%\.claude.json`
- project `.mcp.json` / Claude settings UI

## Antigravity / Gemini tooling

Add the same stdio MCP server in Antigravity’s MCP / tools settings. Prefer the documented MCP config path for your Antigravity surface (IDE vs CLI). Command/args stay:

- command: `node`
- args: `C:\AI-Coding-System\dist\index.js`

## Codex / Windsurf / OpenCode

Any editor that supports **MCP stdio servers** can use the same command/args. Place the server definition in that product’s MCP config file.

## Recommended agent workflow

| Phase | MCP tools |
|-------|-----------|
| Session start | `register_project`, `get_project_context` (or `get_handoff` for fast switch) |
| Task planning | `prepare_context` — task-scoped assembly; opt in to memory/graph only when needed |
| Implementation | `discipline_rules`, `security_refs`; targeted `quality_check` / `security_scan` / `review_diff` |
| Task complete | `finalize_task` — git summary, optional checks, handoff update, session cleanup |

Do **not** wire Claude-Mem, Graphify, Ponytail, or other providers as additional MCP servers (Context Mode peer MCP is the sole exception above). Do **not** call memory, graph, or scan tools on every turn.

## Verify

In the editor chat:

1. Ask: “Call the `doctor` MCP tool from ai-coding-system”
2. Ask: “Register this workspace with `register_project`”
3. Ask: “Call `prepare_context` for this workspace with task: verify MCP wiring”
4. Ask: “Call `discipline_rules`”
5. Ask: “Call `finalize_task` for this workspace with currentTask: verify wiring”

If tools do not appear, confirm `dist\index.js` exists and Node is on PATH for GUI apps (sign out/in after installing Node).
