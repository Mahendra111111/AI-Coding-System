### Task 4: Provider status + doctor expansion + `provider_status` MCP tool

**Files:**
- Create: `src/providers/status.ts`
- Modify: `src/doctor.ts`
- Modify: `src/mcp/tools.ts`
- Test: `tests/provider-status.test.ts`

**Interfaces:**
- Produces: `getAllProviderStatuses(config): ProviderStatusRow[]` where each row has `{ id, role, enabledInConfig, available, detail }`
- Doctor includes optional provider rows without failing overall health for missing optionals.

- [ ] **Step 1: Failing test** — `getAllProviderStatuses` returns ≥14 rows; compression overlap surfaces when both flags true.

- [ ] **Step 2: Implement status checks** using `cliAvailable`, `existsSync(checkout)`, config enabled flags, and `assertCompressionPolicy`.

- [ ] **Step 3: Wire `doctor` + MCP `provider_status` tool** returning JSON of statuses.

- [ ] **Step 4: `npm test` + `npm run build`** — both pass.

- [ ] **Step 5: Commit** — `feat: provider status surface in doctor and MCP`

---

