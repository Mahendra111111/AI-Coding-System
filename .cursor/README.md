# Cursor rules (shipped with ACS)

This folder is the **canonical** Cursor rule set for AI Coding System. Anyone who clones or opens this repo in Cursor gets the same agent workflow.

| File | Purpose |
|------|---------|
| [rules/ai-coding-system-mcp.mdc](rules/ai-coding-system-mcp.mdc) | Always-on ACS MCP workflow (token savings, Von, SEO, Reticle, Caveman) |

## For installers / other machines

1. Open this repository (or a workspace that includes these rules) in Cursor — project rules under `.cursor/rules/` apply automatically when `alwaysApply: true`.
2. Ensure MCP `ai-coding-system` points at `dist/index.js` (see [docs/CONNECT-EDITORS.md](../docs/CONNECT-EDITORS.md) or run `install.ps1`).
3. Optional user-global copy (every workspace on the machine):

```powershell
Copy-Item -Force ".\.cursor\rules\ai-coding-system-mcp.mdc" "$env:USERPROFILE\.cursor\rules\ai-coding-system-mcp.mdc"
```

Do not diverge `examples/cursor-rule.mdc` from this folder — keep [examples/cursor-rule.mdc](../examples/cursor-rule.mdc) as a short pointer only.
