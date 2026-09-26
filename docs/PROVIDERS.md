# Providers and one-command install

AI Coding System (ACS) is the primary MCP entry used by Cursor. Peer MCPs
(Context Mode, Reticle) may be merged by the installer; keep ACS as the facade
for project brain / decide / graph / memory tools.

## One command (happy path)

From the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

Or: `npm run setup`

That single run:

1. Ensures Node / Git / Python (winget when missing)
2. `npm install` + `npm run build`
3. Links ACS CLI onto PATH (`ai-coding-mcp`, `acs-doctor`)
4. Merges Cursor MCP (ACS + Context Mode + Reticle) and copies Cursor rules
5. Runs `scripts/install-providers.ps1` for full-potential CLIs and checkouts

Opt-outs (power users): `-SkipProviders`, `-SkipHeavy` (Semgrep + CodeQL),
`-SkipVon`, `-SkipCursorMcpMerge`. Soft-failures never abort the install — re-run
the same `install.ps1` to retry.

Do **not** install Caveman, Graphify, Von, or peers via separate AI chat prompts.

## Storage sources of truth

| Kind | Canonical store |
| --- | --- |
| Code structure / symbols | Graphify **`graphify-out/graph.json`** in the product workspace |
| Agent durable brain | ACS `projects/<id>/context/` markdown (HANDOFF, PROJECT_STATE, …) |

Do not invent project-structure dumps as `.sql`, free-form structure `.md`, or
alternate JSON layouts. When the graph is empty, ACS auto-indexes on
`graph_query` / `graph_explain` / `prepare_context` with `includeGraph` (or call
`graph_index` explicitly).

## Provider catalog

| Provider | Purpose | Installation and behavior |
| --- | --- | --- |
| ACS CLI | `ai-coding-mcp` / `acs-doctor` | Linked by `install.ps1` (`npm link`). |
| Graphify | Code-structure indexing | `uv tool install graphifyy` (installer ensures `uv` when possible). Canonical output: `graphify-out/graph.json`. |
| Context Mode | Tool-context control | Global `context-mode` + peer MCP merge. Coexists with Caveman. |
| OpenCodeReview | Code review | Global `@alibaba-group/open-code-review` (`ocr` CLI). |
| Ponytail | Implementation discipline | Shallow-cloned to `providers/skills/ponytail`. |
| Caveman | Output compression | Shallow-cloned to `providers/skills/caveman`. |
| Anthropic Skills | Task-skill templates | ACS layout under `skills/` (not a full anthropics clone). |
| OWASP SCP / Top 10 | Security reference | Shallow-cloned under `providers/refs/`. |
| Claude-Mem | Historical memory | Soft-attempted by installer (`npx claude-mem install --provider host`); no forced cloud sign-in. Worker URL may be in `~/.claude-mem/settings.json`. |
| Semgrep | Fast security scanning | User `pip` unless `-SkipHeavy`. |
| CodeQL | Deep security analysis | Soft-download into `tools/codeql` unless `-SkipHeavy`. |
| Prettier / ESLint | Format / quality | Detected in target projects (not installed by ACS). |
| Von | Decision routing | Soft-installed via `pip install git+https://github.com/wfzyx/von.git`. `von.autoStart` starts `von serve` on first `decide_tools`. First cold start may download HF weights (~1.5GB+). |
| Reticle | Runtime UI verification | Global `@reticlehq/server` + MCP setup; peer MCP (not proxied through ACS). Per app: `npx @reticlehq/server init`. |
| Next SEO | SEO Engine + Next.js | App-local `npm install next-seo`. ACS: `seo_guidance` + `skills/next-seo`. |

Generated checkouts under `providers/skills/` and `providers/refs/` are
gitignored local dependencies. `providers/registry.json` remains tracked.

### Von + Reticle workflow

1. When unsure which ACS tool to call → `decide_tools` (Von).
2. If the decision is `reticle_verify` → use the **Reticle** peer MCP against the running app.
3. Call `reticle_guidance` for the checklist without leaving ACS.

### SEO-first content workflow

1. User supplies audience / intent / keywords (or agent asks once).
2. Call `seo_guidance` — returns ACS SEO Engine + next-seo wiring.
3. In the **app** workspace: ensure `next-seo` is installed; ship people-first content + metadata + JSON-LD together.
4. Follow pre-publish audit (§29). Never promise rankings.

## Local project brains (not in Git)

Per-user project state lives under `projects/<id>/` and the index at
`state/registry.json`. Those paths are **gitignored**. Use MCP
`register_project` / `list_projects` on each machine.
