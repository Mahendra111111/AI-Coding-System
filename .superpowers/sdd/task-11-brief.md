### Task 11: Security orchestrator

**Files:**
- Create: `src/security/scan.ts`
- Modify: `src/mcp/tools.ts`
- Test: `tests/security-scan.test.ts`

**Interfaces:**
- `runSecurityScan(config, { workspacePath, policy?: SecurityPolicy }): string`
- `light`: semgrep if enabled+available else “skipped”
- `normal`: light + note to run review
- `deep`: normal + codeql/bearer if enabled+available
- Truncate findings to 3k chars; never dump full SARIF.

Exhaustive switch on `SecurityPolicy` with `never` default.

- [ ] MCP `security_scan` + commit `feat: security scan orchestrator (semgrep-first)`

---

