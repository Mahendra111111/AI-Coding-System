# Optional providers

AI Coding System (ACS) is the single MCP entry used by Cursor. Keep one Cursor
MCP server named `ai-coding-system`; installing providers does not add more
Cursor MCP entries.

Run the idempotent installer from the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-providers.ps1
```

Use `-SkipHeavy` to skip the Semgrep installation. Network and package failures
are reported but do not fail the script, so it is safe to rerun.

## Provider catalog

| Provider | Purpose | Installation and behavior |
| --- | --- | --- |
| Graphify | Code-structure indexing | Installs `graphifyy` with `uv tool`, then falls back to `pipx` or user-scoped `pip`. |
| Context Mode | Tool-context control | Peer MCP for tool-context sandboxing (`contextMode.enabled: true`). Install with `npm install -g context-mode`. ACS does not invoke or proxy it yet. Coexists with Caveman. |
| OpenCodeReview | Code review | Installs global npm package `@alibaba-group/open-code-review`; its expected CLI is `ocr`. |
| Ponytail | Implementation discipline | Shallow-cloned to `providers/skills/ponytail`. An existing checkout is left unchanged. |
| Caveman | Output compression | Shallow-cloned to `providers/skills/caveman`. ACS output-compression guidance via `compression_guidance` when `caveman.enabled: true`. Coexists with Context Mode (separate roles: tool-context vs agent terse-output). |
| Anthropic Skills | Task-skill templates | ACS Task 14 layout under `skills/` (`skills/_template/SKILL.md`). Not a full `anthropics/skills` clone. Use `list_acs_skills` / `provider_status`. |
| OWASP Secure Coding Practices | Security reference | Shallow-cloned to `providers/refs/owasp-scp`. |
| OWASP Top 10 | Security reference | Shallow-cloned to `providers/refs/owasp-top10`. |
| Claude-Mem | Historical memory | Not installed automatically. Run `npx claude-mem install --provider host` when ready; the installer does not force cloud sign-in. ACS defaults to `http://127.0.0.1:37777`, but current Claude-Mem releases assign a per-user port (`37700 + uid % 100`) and store it in `~/.claude-mem/settings.json`; set `CLAUDE_MEM_WORKER_URL` to the active base URL when it differs. |
| Semgrep | Fast security scanning | Installed with user-scoped `pip` unless already available or `-SkipHeavy` is set. Failure is non-fatal. |
| CodeQL | Deep security analysis | Install CLI under `tools/codeql` (Windows: download `codeql-win64.zip` from [codeql-cli-binaries](https://github.com/github/codeql-cli-binaries/releases)). ACS probes `tools/codeql` and PATH. Prepare a DB with `codeql database create`, then set `CODEQL_DATABASE` or `<workspace>/codeql-db`. |
| Prettier | Formatting | Detected on PATH or in registered project `node_modules/.bin` (including `apps/*` / `packages/*`). |
| ESLint | JavaScript quality | Detected on PATH or in registered project `node_modules/.bin` (including `apps/*` / `packages/*`). |

The generated checkouts under `providers/skills/` and `providers/refs/` are
local, ignored dependencies. `providers/registry.json` remains tracked as the
provider manifest.

## Local project brains (not in Git)

Per-user project state lives under `projects/<id>/` and the index at
`state/registry.json`. Those paths are **gitignored** so each machine/user
registers and manages their own products locally — nothing project-specific is
published to GitHub. Use MCP `register_project` / `list_projects` on each
install.
