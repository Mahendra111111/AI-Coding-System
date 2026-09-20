# Task 11 Report: Security orchestrator

## Status

DONE

## Implementation

- Added `src/security/scan.ts` with `runSecurityScan(config, options)`.
- Implemented exhaustive `SecurityPolicy` handling:
  - `light`: Semgrep when enabled and available.
  - `normal`: light scan plus review-tool guidance.
  - `deep`: normal scan plus enabled and available CodeQL and Bearer.
- All scanner availability checks use `cliAvailable` from `providers/which.ts`.
- Structured Semgrep and Bearer output is normalized to compact finding lines.
- CodeQL requests CSV output; the orchestrator does not request or return SARIF.
- Final output is capped at 3,000 characters.
- Added the `security_scan` MCP tool with an optional validated policy.
- Added `tests/security-scan.test.ts` covering policy behavior, defaults, skipped tools, command selection, compact output, and truncation.

## Validation

- Targeted test: 1 file passed, 5 tests passed.
- Full test suite: 12 files passed, 46 tests passed.
- TypeScript build: passed.
- IDE diagnostics only reported two pre-existing stale module-resolution errors in `src/mcp/tools.ts` for `caveman.js` and `ponytail.js`; `tsc` passed.

## Concerns

- CodeQL's deep path invokes database analysis against the workspace path. CodeQL requires that path to be a prepared database; source workspaces without one return a compact command failure rather than generating SARIF or mutating the workspace.
- The shell did not initially include Node.js on `PATH`; validation succeeded after prepending `C:\Program Files\nodejs`.
