# Connect editors to AI Coding System MCP

Server entry (after `npm run build`):

`C:\AI-Coding-System\dist\index.js`

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

## Verify

In the editor chat:

1. Ask: “Call the `doctor` MCP tool from ai-coding-system”
2. Ask: “Register this workspace with `register_project`”
3. Ask: “Call `get_project_context` for this workspace”

If tools do not appear, confirm `dist\index.js` exists and Node is on PATH for GUI apps (sign out/in after installing Node).
