# Task 9 SDD Review: OpenCodeReview Adapter

**Reviewed:** 2026-09-20  
**Commit:** `248916c` — `feat: OpenCodeReview provider writing to projects/<id>/reviews`  
**Base:** `b9c096e`

## Verdict

**Spec ✅ · Approved**

Task 9 matches the brief, plan, and facade design. OpenCodeReview output is persisted under `projects/<id>/reviews/`, MCP tools are wired, and tests cover the required paths.

---

## Brief compliance

| Requirement | Status |
|---|---|
| `src/providers/openCodeReview.ts` with `runOpenCodeReview(config, { workspacePath, projectId, mode })` | ✅ |
| Missing `ocr` CLI → install hint | ✅ |
| `ocr review --format json` (diff) / `ocr scan --format json` (scan) | ✅ |
| JSON written under `reviewsDir(config, projectId)` | ✅ |
| Return saved path + truncated summary (4k) | ✅ |
| Exhaustive `mode` switch with `never` | ✅ |
| `registerProject` creates `reviews/` and `temp/` | ✅ (pre-existing in `createBrainDirs`; verified by test) |
| MCP `review_diff`, `review_scan` | ✅ |
| `tests/review-paths.test.ts` | ✅ (4 cases) |
| Commit message per brief | ✅ |

---

## Spec / design alignment

| Design point | Status |
|---|---|
| Review group tools `review_diff`, `review_scan` (§6) | ✅ |
| OpenCodeReview results in `projects\<id>\reviews\` (§4, §8) | ✅ |
| Install hint matches registry (`npm install -g @alibaba-group/open-code-review`) | ✅ |
| ACS SoT unchanged — no auto-merge into `get_project_context` | ✅ |
| Imports at top of module | ✅ |

---

## Strengths

- **Correct command mapping** — `commandForMode` uses exhaustive switch; diff → `review`, scan → `scan`.
- **Soft-fail on OCR errors** — captures stdout/stderr on failure, still persists output for audit.
- **Project scoping** — MCP tools resolve `projectId` via `resolveProjectId`, consistent with handoff/state tools.
- **Focused tests** — registration dirs, both modes, install-hint path; mocks keep tests deterministic.
- **Minimal diff** — no unnecessary changes to `register.ts`; `reviews/` already provisioned at registration.

---

## Minor nits (non-blocking)

1. **No config gate** — `review_diff` / `review_scan` register unconditionally; `graph_*` tools are gated on `config.graphify.enabled`. Consider matching that pattern when `review.openCodeReview.enabled` is false (same gap as quality tools).
2. **No truncation test** — 4k cap is implemented but not asserted in tests.
3. **Tests not re-run in review shell** — report claims 37/37 pass; `npm` unavailable in reviewer environment.

---

## Files reviewed

| File | Notes |
|---|---|
| `src/providers/openCodeReview.ts` | Core adapter |
| `src/mcp/tools.ts` | MCP registration |
| `tests/review-paths.test.ts` | Unit tests |
| `src/project/register.ts` | Confirmed `reviews/` + `temp/` in `createBrainDirs` (unchanged in commit) |
| `src/core/paths.ts` | `reviewsDir` helper used correctly |
