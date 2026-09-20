<div align="center">

# AI Coding System

**One MCP server. Every editor remembers.**

Stop re-explaining your architecture to Cursor, then Claude Code, then Antigravity. Register a project once — every MCP-capable editor shares the same durable brain.

<a href="https://github.com/Mahendra111111/AI-Coding-System/stargazers"><img src="https://img.shields.io/github/stars/Mahendra111111/AI-Coding-System?style=flat-square&color=6366F1&label=stars" alt="GitHub stars"></a>
<a href="https://github.com/Mahendra111111/AI-Coding-System/blob/master/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License"></a>
<a href="#"><img src="https://img.shields.io/badge/node-%3E%3D20-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node >=20"></a>
<a href="#"><img src="https://img.shields.io/badge/built_with-TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript"></a>
<a href="#"><img src="https://img.shields.io/badge/protocol-MCP-8A2BE2?style=flat-square" alt="MCP"></a>
<a href="#"><img src="https://img.shields.io/badge/tools-24_MCP_tools-orange?style=flat-square" alt="24 MCP tools"></a>

**[Quick Start](#quick-start) · [Why it exists](#why-this-exists) · [MCP Tools](#mcp-tools) · [Architecture](#architecture) · [Providers](#providers) · [Develop](#develop) · [Docs](#docs)**

</div>

---

## Why this exists

AI coding editors are stateless between sessions. Every new chat, you re-explain the same architecture, the same constraints, the same "we tried that already, it broke prod." Switch editors mid-project — Cursor to Claude Code, say — and you start from zero again.

**AI Coding System** is a local **MCP server** that gives every editor on your machine the same durable, compact project context:

- **One brain per project** — architecture, decisions, constraints, and handoff notes, generated once and shared everywhere
- **Editor-agnostic** — Cursor, Claude Code, Antigravity, or anything else that speaks MCP connects to the same server
- **Identity that survives folder moves** — projects are identified by git remote (or canonical path), not by wherever they happen to sit today
- **One facade, many providers** — Graphify, Claude-Mem, Semgrep, OWASP references and more are thin adapters behind a single tool surface, so your editor config stays simple
- **No context bloat** — compact, tagged, task-scoped context assembly; never full-repo dumps, never raw chat transcripts

Your source code stays exactly where it already lives. Only the project's "brain" — a handful of Markdown and JSON files — lives under the system root.

---

## Quick Start

### Install (Windows)

```powershell
cd C:\AI-Coding-System
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

Restart your editor (or reload MCP) afterwards. The installer merges into `%USERPROFILE%\.cursor\mcp.json`, with a backup taken first.

<details>
<summary><strong>node / npm not recognized?</strong></summary>

<br>

Build directly instead:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build.ps1
```

Or point at the full path:

```powershell
& "C:\Program Files\nodejs\npm.cmd" run build
```

</details>

<details>
<summary><strong>Manual MCP entry</strong> · when PATH is incomplete for GUI apps</summary>

<br>

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

</details>

### How agents use it

1. Call `register_project` or `get_project_context` with the workspace path
2. Work using the compact context returned — architecture, handoff, constraints, decisions
3. After meaningful work, call `update_handoff` (and optionally `update_project_state`)

Want a lightweight nudge so your editor calls these automatically? See the [Cursor rule example](examples/cursor-rule.mdc).

---

## MCP Tools

**24 tools, one server (`ai-coding-system`):**

| Group | Tools |
|---|---|
| **Project** | `register_project`, `get_project_context`, `get_handoff`, `update_handoff`, `update_project_state`, `list_projects` |
| **Orchestrate** | `prepare_context`, `finalize_task` |
| **Graph** | `graph_index`, `graph_query`, `graph_explain` |
| **Memory** | `memory_search`, `memory_get` |
| **Discipline** | `discipline_rules`, `compression_guidance` |
| **Quality** | `quality_detect`, `quality_check` |
| **Review** | `review_diff`, `review_scan` |
| **Security** | `security_refs`, `security_scan` |
| **Meta** | `doctor`, `provider_status`, `get_git_summary` |

> Editor showing only ~11 tools? Rebuild (`scripts\build.ps1`) and reload MCP.

---

## Architecture

```
C:\AI-Coding-System\
  src\                 TypeScript source
  dist\                Built MCP entry (node dist/index.js)
  config\system.json   System config
  templates\           Seed Markdown for new projects
  skills\              ACS task skills
  projects\<id>\       Per-project brain
    project.json
    context\
      PROJECT_STATE.md
      HANDOFF.md
      DECISIONS.md
      CONSTRAINTS.md
      ARCHITECTURE.md
  state\registry.json  Index of all registered projects
```

### Project identity

```
workspace path
  -> git remote? normalize -> remote:<host>/<path>
  -> else path:<canonical lowercase path>
  -> SHA-256 -> 20-char hex projectId
```

Move a folder that keeps the same git remote, and it resolves to the **same** `projectId` — `workspacePath` just gets updated. No orphaned duplicate brains.

### Context assembly

`get_project_context` builds a compact, tagged document in a fixed order: project metadata, technology/architecture, current work + next action, handoff, recent/constraints/decisions, validation/known issues, optional git summary. **No full-repo dumps. No chat transcripts.**

`prepare_context` goes further for task-scoped work — task, acceptance criteria, modified files, build errors, security findings, architecture, constraints, handoff — and stops as soon as it has enough. `finalize_task` closes the loop: git summary, build validation, optional quality/security/review checks, handoff update, and temp cleanup.

---

## Providers

External tools are thin adapters — you configure only `ai-coding-system` in your editor, and it invokes providers on demand:

| Provider | Role |
|---|---|
| **Graphify** | Code-structure graph indexing |
| **Claude-Mem** | Historical memory across sessions |
| **Ponytail** | Implementation-discipline rules |
| **Caveman** | Output compression guidance |
| **context-mode** | Tool-context control |
| **Open Code Review** | Automated code review |
| **OWASP SCP / Top 10** | Security knowledge references |
| **Semgrep** | Static security scanning |

Each degrades gracefully with an install hint if its CLI isn't found — nothing breaks if you skip a provider you don't need.

---

## Develop

```powershell
# When PATH has node/npm:
npm install
npm run build
npm test

# If npm/node are "not recognized":
powershell -ExecutionPolicy Bypass -File .\scripts\build.ps1
```

Run the health check any time with:

```powershell
npm run doctor
```

---

## Docs

- [Connect your editor](docs/CONNECT-EDITORS.md)
- [Full architecture reference](docs/ARCHITECTURE.md)
- [Provider details](docs/PROVIDERS.md)

### Optional: Graphify

```powershell
winget install astral-sh.uv
uv tool install graphifyy
```

Then use the `graph_index` / `graph_query` MCP tools.

---

## Safety

- `register_project` is idempotent — safe to call repeatedly
- State and handoff files are written atomically
- This MCP never deletes or modifies your source files
- Telemetry is **off by default**

---

## License

[MIT](./LICENSE)

---

<sub>
Built for developers juggling more than one AI coding editor on the same project.
</sub>