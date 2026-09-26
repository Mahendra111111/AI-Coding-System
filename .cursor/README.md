# Cursor rules (shipped with ACS)

This folder is the **canonical** Cursor rule set for AI Coding System. Anyone who clones or opens this repo in Cursor gets the same agent workflow.

| File | Purpose |
|------|---------|
| [rules/ai-coding-system-mcp.mdc](rules/ai-coding-system-mcp.mdc) | Always-on ACS workflow (one-command install, Graphify JSON SoT, Von, SEO, Reticle, Caveman) |
| [rules/seo-engine.mdc](rules/seo-engine.mdc) | Always-on ACS SEO Engine (people-first / intent / next-seo; no ranking promises) |

## For installers / other machines

1. Open this repository (or a workspace that includes these rules) in Cursor — project rules under `.cursor/rules/` apply automatically when `alwaysApply: true`.
2. Run **one** installer: `powershell -ExecutionPolicy Bypass -File .\install.ps1` (CLI + providers + MCP + rules).
3. Optional user-global rule copy is also done by `install.ps1`.
