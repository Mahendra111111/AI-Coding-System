# Final Review Production Blockers — Fix Report

Date: 2026-09-20

## Fixed

- Context Mode is documented and reported as the preferred compression policy label, with explicit peer-MCP invocation required until ACS proxies it.
- `finalize_task` leaves quality, security, and review items incomplete for skipped, unavailable, conflicted, failed, error, refusal, or install-hint output. Provider command failures now include explicit failure markers.
- Deep CodeQL scans require an existing database from `CODEQL_DATABASE` or `<workspace>/codeql-db`; source trees are never passed as databases.
- OpenCodeReview validates safe project IDs and verifies the resolved reviews directory remains beneath the managed projects root.
- `provider_status` catches registry failures and returns a JSON error object.
- Added `"none"` and caveman-only compression-policy assertions.
- `discipline_rules` now honors `ponytail.enabled`.

## Verification

- Targeted regression tests: 28 passed.
- Full suite: 14 files, 60 tests passed.
- TypeScript build: passed.
- `git diff --check`: passed.

## Notes

- Existing unrelated modified and untracked SDD artifacts were left untouched and excluded from the fix commit.
