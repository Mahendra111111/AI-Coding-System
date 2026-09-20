### Task 7: OWASP topic refs tool

**Files:**
- Create: `src/providers/owasp.ts`
- Modify: `src/mcp/tools.ts`
- Test: `tests/owasp-refs.test.ts`

**Interfaces:**
- `securityRefs(config, topic: string, maxChars = 2000): string` — search `providers/refs/` for files matching topic keywords; return truncated excerpts; if refs missing, return install hint.

Topics enum (exhaustive switch): `"input-validation" | "auth" | "session" | "crypto" | "injection" | "access-control" | "config" | "general"`.

- [ ] TDD + MCP tool `security_refs` + commit `feat: task-scoped OWASP security refs tool`

---

