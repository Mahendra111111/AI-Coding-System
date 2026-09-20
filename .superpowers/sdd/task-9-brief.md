### Task 9: OpenCodeReview adapter

**Files:**
- Create: `src/providers/openCodeReview.ts`
- Modify: `src/project/register.ts` or paths ensure `reviews/` on register
- Modify: `src/mcp/tools.ts`
- Test: `tests/review-paths.test.ts`

**Interfaces:**
- `runOpenCodeReview(config, { workspacePath, projectId, mode: "diff" | "scan" }): string` — if `ocr` missing, return install hint; else run `ocr review --format json` (diff) or `ocr scan --format json` with output file under `reviewsDir`; return path + truncated summary.

- [ ] Ensure `registerProject` creates `reviews/` and `temp/` directories.
- [ ] MCP: `review_diff`, `review_scan`
- [ ] Commit `feat: OpenCodeReview provider writing to projects/<id>/reviews`

---

