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
| Context Mode | Tool-context control | `contextMode.enabled` selects the preferred compression policy label only; ACS does not invoke or proxy Context Mode yet. Configure and invoke it as a peer MCP server according to its upstream README until ACS proxy support exists. |
| OpenCodeReview | Code review | Installs global npm package `@alibaba-group/open-code-review`; its expected CLI is `ocr`. |
| Ponytail | Implementation discipline | Shallow-cloned to `providers/skills/ponytail`. An existing checkout is left unchanged. |
| Caveman | Output compression | Shallow-cloned to `providers/skills/caveman`. It is installed but config-disabled by default because ACS compression modes are mutually exclusive. |
| OWASP Secure Coding Practices | Security reference | Shallow-cloned to `providers/refs/owasp-scp`. |
| OWASP Top 10 | Security reference | Shallow-cloned to `providers/refs/owasp-top10`. |
| Claude-Mem | Historical memory | Not installed automatically. Run `npx claude-mem install --provider host` when ready; the installer does not force cloud sign-in. ACS defaults to `http://127.0.0.1:37777`, but current Claude-Mem releases assign a per-user port (`37700 + uid % 100`) and store it in `~/.claude-mem/settings.json`; set `CLAUDE_MEM_WORKER_URL` to the active base URL when it differs. |
| Semgrep | Fast security scanning | Installed with user-scoped `pip` unless already available or `-SkipHeavy` is set. Failure is non-fatal. |
| CodeQL | Deep security analysis | Detection only. Install the [CodeQL CLI](https://docs.github.com/en/code-security/codeql-cli), prepare a database with `codeql database create`, then set `CODEQL_DATABASE` or place the database at `<workspace>/codeql-db`. ACS never analyzes a source tree as if it were a database. |
| Bearer | Data-flow security analysis | Detection only. Install the [Bearer CLI](https://docs.bearer.com/guides/installation/) manually when needed. |
| Prettier | Formatting | Detected in each target project; no source repository is cloned. |
| ESLint | JavaScript quality | Detected in each target project; no source repository is cloned. |
| Biome | Unified formatting and linting | Detected in each target project; no source repository is cloned. |

The generated checkouts under `providers/skills/` and `providers/refs/` are
local, ignored dependencies. `providers/registry.json` remains tracked as the
provider manifest.
