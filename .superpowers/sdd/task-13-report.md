# Task 13 Report: finalize_task workflow

## Status

DONE

## Implementation

- Added package build-script detection and bounded build validation using `validation.maxBuildAttempts`.
- Build failures return only extracted error lines; projects without a build script are skipped.
- Added `finalizeTask(config, args)` with ordered git, build, optional quality, optional security, optional review, handoff, and cleanup checklist entries.
- Review execution respects `review.openCodeReview.enabled`.
- Session cleanup accepts a constrained session identifier and removes only the resolved managed `projects/<id>/temp/<session>` directory.
- Registered the `finalize_task` MCP tool with optional checks disabled by default.
- Added workflow-order, optional-check, handoff, managed-cleanup, and traversal-refusal tests.

## Validation

- Targeted test: 1 file passed, 2 tests passed.
- Full suite: 14 files passed, 51 tests passed.
- TypeScript build: passed.
- `git diff --check`: passed.
- IDE diagnostics only reported the two pre-existing stale module-resolution errors for `caveman.js` and `ponytail.js`; `tsc` passed.

## Commit

- `feat: finalize_task end-of-task workflow`
