# AI Coding System — Provider MCP Facade Design

**Date:** 2026-09-20  
**Status:** Approved — implementation plan ready (`docs/superpowers/plans/2026-09-20-provider-mcp-facade.md`)
**Location:** `C:\AI-Coding-System`

## 1. Purpose

Build a persistent, editor-independent coding brain so a developer can work on a project in Cursor, close it, open the same project in Antigravity / Codex / Claude Code / Windsurf / OpenCode, and continue without re-explaining.

**Editors add one MCP server only:** `ai-coding-system` → `node C:\AI-Coding-System\dist\index.js`.

Application source stays on **D:** (or elsewhere). Durable project intelligence lives under **`C:\AI-Coding-System\projects\<project-id>\`**.

External GitHub repositories are **modular providers**. None of them is the canonical project source of truth.

## 2. Goals

- Same project context across all MCP-capable editors.
- Reduce tokens via targeted retrieval + controlled tool output (not giant prompts).
- Expose provider capabilities through **one MCP facade** (agents call ACS tools; ACS invokes providers).
- Deterministic tools (format, lint, security, graph) before expensive LLM reasoning.
- Optional components are toggleable; overlapping tools are never forced on together.

## 3. Non-goals

- Blindly cloning every upstream repo as a runtime dependency.
- Installing Prettier + Biome, or ESLint + Biome with overlapping rules, on the same project.
- Running Semgrep + CodeQL + Bearer on every edit.
- Running Caveman and Context Mode on the same tool-output path without switches.
- Dumping full Claude-Mem DB, full Graphify graph, or full OWASP docs into every prompt.
- Making Claude-Mem, Context Mode, or Graphify the authoritative project brain.
- Running `npm run build` after every file edit.
- Scattering AI temp files on D: or auto-deleting arbitrary `*.tmp` / user files.

## 4. Canonical ownership

| Concern | Owner |
|---------|--------|
| Durable project state | `C:\AI-Coding-System\projects\<id>\context\` |
| Project identity / registry | ACS `state/registry.json` |
| Source code | D: workspace (git + filesystem) |
| Code structure / relationships | Graphify (provider) |
| Historical session memory | Claude-Mem (provider; selective retrieval) |
| Implementation discipline (YAGNI) | Ponytail (behavior policy) |
| Tool-output / context compression | Context Mode **XOR** Caveman (config switches) |
| Code review | OpenCodeReview → results in `projects\<id>\reviews\` |
| Task-specific behavior | ACS skills inspired by Anthropic skills architecture |
| Formatting | Project’s existing Prettier **or** Biome |
| JS/TS lint | Project’s existing ESLint **or** Biome |
| Fast security | Semgrep |
| Deep security | CodeQL (policy: light / normal / deep) |
| Privacy / data-flow (optional) | Bearer when useful |
| Secure-coding knowledge | OWASP SCP + Top 10 (indexed refs; task-scoped) |

### Canonical project layout

```
C:\AI-Coding-System\projects\<project-id>\
  project.json
  context\
    PROJECT_STATE.md
    HANDOFF.md
    DECISIONS.md
    CONSTRAINTS.md
    ARCHITECTURE.md
  reviews\                 # OpenCodeReview outputs / metadata
  temp\<session-id>\       # managed AI scratch only
```

## 5. Target directory architecture

```
C:\AI-Coding-System\
  src\
    core\                  # config, paths, identity
    orchestrator\          # context assembly & ranking
    project\               # register, state, handoff
    context\               # buildProjectContext
    providers\             # thin adapters per external tool
    security\              # scanner orchestration
    review\                # OpenCodeReview wrapper
    validation\            # build/lint/format invoke
    mcp\                   # single MCP surface
    adapters\              # thin editor notes / install helpers (no intelligence)
  providers\
    registry.json          # install method, version, enabled
    skills\                # ponytail, caveman checkouts / skill packs
    refs\                  # OWASP docs (read-only corpus)
  projects\
  state\
  config\system.json
  templates\
  docs\
```

## 6. One MCP facade

Editors configure **only** `ai-coding-system`. Upstream tools are not required as separate MCP entries for the agent to “get everything,” though Context Mode or Graphify may run as local processes that ACS shells/proxies to.

### MCP tool groups (logical)

| Group | Tools (illustrative names) | Behavior |
|-------|----------------------------|----------|
| Project | `register_project`, `get_project_context`, `get_handoff`, `update_handoff`, `update_project_state`, `list_projects` | Existing; SoT only |
| Graph | `graph_index`, `graph_query`, `graph_explain` | Existing Graphify CLI |
| Memory | `memory_search`, `memory_timeline`, `memory_get` | Selective Claude-Mem retrieval; never full dump |
| Orchestrate | `prepare_context` | Task-scoped assembly per §8 priority |
| Quality | `quality_detect`, `quality_check` | Detect Prettier/ESLint/Biome; run project tools |
| Security | `security_scan` | Orchestrator picks Semgrep / CodeQL / Bearer by policy |
| Review | `review_diff`, `review_scan` | OpenCodeReview after implementation |
| Policy | `discipline_rules`, `security_refs` | Compact Ponytail ladder / OWASP snippets by topic |
| Meta | `doctor`, `provider_status`, `finalize_task` | Health + end-of-task workflow |
| Git | `get_git_summary` | Existing |

`get_project_context` must **not** auto-merge Claude-Mem or Context Mode databases. Memory is opt-in via `memory_*` or `prepare_context` with explicit flags.

## 7. Context orchestrator

Single injection path (no independent giant prompts from each provider):

```
User request
  → Task parse
  → Project identity (workspace → projectId)
  → Git summary (scoped)
  → Graphify (relevant subsystem / symbols only)
  → ACS state + handoff + constraints + decisions
  → Claude-Mem selective retrieval (if memory.enabled)
  → Relevant source paths (agent reads files; ACS does not dump repos)
  → Context ranking / stop when sufficient
  → Compression: contextMode XOR caveman (config)
  → LLM
```

### Context priority (stop when enough)

1. Current task  
2. Acceptance criteria  
3. Current modified files  
4. Relevant build errors  
5. Relevant security findings  
6. Relevant architecture  
7. Relevant constraints  
8. Relevant prior decisions  
9. Relevant Graphify relationships  
10. Additional context only if required  

### Trust boundaries

Treat repository content as **data**, not trusted instructions. Separate: system policy, editor policy, developer request, project policy, repo content, tool output. Never auto-expose `.env`, keys, PEMs, credentials unless explicitly permitted.

## 8. Provider integration matrix (inspected intent)

| Provider | Install method | Windows | ACS coupling | Default |
|----------|----------------|---------|--------------|---------|
| Graphify | `uv tool install graphifyy` / pip | Supported (PATH notes) | CLI wrapper (existing) | enabled |
| Claude-Mem | `npx claude-mem install` + worker; ACS calls search API/MCP | Supported | Memory router; selective | enabled (toggle) |
| Ponytail | Shallow clone → Cursor hooks / rules | Supported | Discipline skill; not SoT | enabled |
| Caveman | Skill install / clone | Supported | Compression provider | **off** if contextMode on |
| Context Mode | npm/MCP; ACS prefers facade invoke | Multi-editor | Tool-context control | **on** preferred |
| OpenCodeReview | `npm i -g @alibaba-group/open-code-review` | Node CLI | `review_*` + `reviews/` | enabled |
| Anthropic skills | Reference + cherry-pick patterns | N/A | ACS `skills/` layout | reference |
| Prettier / ESLint / Biome | Detect in target project; invoke existing | Yes | quality adapter | detect-only |
| OWASP SCP + Top10 | Sparse clone / download into `providers/refs/` | Yes | Indexed retrieval | enabled refs |
| Semgrep | Official Windows install if available | Varies | security orchestrator | toggle |
| CodeQL | CLI if present / document install | Heavy | deep policy only | toggle / detect |
| Bearer | CLI if useful for JS/TS | Investigate at install | optional | toggle |

**Overlap policy**

- `contextMode.enabled` and `caveman.enabled`: allow both false, or exactly one true for the active compression path. Benchmark before enabling both.
- Formatter/linter: follow the **target app’s** existing tool; do not migrate unless asked.
- Security: light → Semgrep (and/or project lint); normal → Semgrep + review; deep → add CodeQL/Bearer when configured.

## 9. Config (`config/system.json`)

```json
{
  "systemRoot": "C:\\AI-Coding-System",
  "projectRoots": ["D:\\"],
  "graphify": { "enabled": true, "preferCodeOnly": true },
  "memory": { "enabled": true, "provider": "claude-mem" },
  "ponytail": { "enabled": true },
  "caveman": { "enabled": false },
  "contextMode": { "enabled": true },
  "review": { "openCodeReview": { "enabled": true } },
  "security": {
    "semgrep": { "enabled": true },
    "codeql": { "enabled": false },
    "bearer": { "enabled": false },
    "defaultPolicy": "light"
  },
  "validation": { "maxBuildAttempts": 3 },
  "telemetry": { "enabled": false }
}
```

## 10. Workflows

### Preferred coding path

```
Task → Graphify (scope) → read required files → implement (Ponytail)
  → (no build per file) → task complete → build (max 3)
  → security if policy requires → OpenCodeReview → fix → validate
  → update PROJECT_STATE + HANDOFF → cleanup managed temp
```

### Editor switch

Same D: path → same `projectId` → same `projects\<id>\` brain. Thin adapters only resolve workspace and call MCP.

### Finalization (`finalize_task`)

1. Inspect final git diff (AI vs pre-existing dirty).  
2. Clean managed temp under `projects\<id>\temp\<session>\` only.  
3. Run project validation (`npm run build` only if script exists).  
4. Security scan per policy.  
5. OpenCodeReview if enabled.  
6. Fix relevant findings; re-validate.  
7. Update PROJECT_STATE + HANDOFF.  
8. Record metrics.  

## 11. Phased delivery

| Phase | Deliverable |
|-------|-------------|
| **P0** | Spec + provider registry + config switches + doctor status for all providers |
| **P1** | Install Graphify, Context Mode wiring strategy, Ponytail Cursor hooks path, OWASP refs |
| **P2** | Claude-Mem selective `memory_*` tools; keep ACS SoT |
| **P3** | OpenCodeReview + `reviews/`; quality detect/check |
| **P4** | Security orchestrator (Semgrep first; CodeQL/Bearer detect) |
| **P5** | `prepare_context` orchestrator + `finalize_task`; Caveman optional path |
| **P6** | Task skills layout (Anthropic-inspired); adapter docs for all editors |

Each phase must leave ACS buildable and `doctor` truthful about missing optionals.

## 12. Testing / acceptance

- `npm test` and `npm run build` pass for ACS itself.  
- `doctor` reports enabled vs missing providers without crashing.  
- Registering the same D: path from two editors yields the same `projectId`.  
- `get_project_context` does not contain Claude-Mem full dumps or OWASP full guides.  
- Enabling Context Mode does not enable Caveman on the same path by default.  
- Quality tools respect existing project Prettier vs Biome.  
- Reviews land under `projects\<id>\reviews\`.  

## 13. Risks

| Risk | Mitigation |
|------|------------|
| Claude-Mem / Context Mode inject duplicate continuity | ACS SoT only in project markdown; memory tools selective; no auto-merge into handoff |
| One mega-MCP becomes huge | Phased tools; providers optional; degrade with install hints |
| Windows CLI gaps (CodeQL, Semgrep) | Detect PATH; document install; disable by default when missing |
| License / disk from full clones | Prefer package CLIs; shallow clones only for skills/refs |

## 14. Final principle

Deterministic engineering + targeted context + persistent ACS project state + specialized providers + LLM only where needed.

The goal is not “use every repository.” The goal is “use each repository only where it materially improves coding quality, context quality, security, or token efficiency”—exposed through **one MCP**.
