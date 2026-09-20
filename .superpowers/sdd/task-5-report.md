# Task 5 report: P1 provider install script

## Status

Complete. Added an idempotent, soft-failing PowerShell installer, provider
documentation, and ignore rules for generated provider checkouts.

## Changed files

- `scripts/install-providers.ps1`
  - Adds `-SkipHeavy`.
  - Adds known Node, npm-global, and Git directories to the process PATH.
  - Installs Graphify with `uv`, `pipx`, or user-scoped `pip`.
  - Checks npm availability before installing Context Mode.
  - Installs OpenCodeReview.
  - Creates shallow Ponytail, Caveman, OWASP SCP, and OWASP Top 10 checkouts.
  - Prints the host-mode Claude-Mem command without running it.
  - Soft-fails Semgrep installation and skips it with `-SkipHeavy`.
  - Detects CodeQL and Bearer without installing them.
  - Never clones Prettier, ESLint, or Biome.
- `docs/PROVIDERS.md`
  - Documents every registry provider, install behavior, manual steps, local
    checkout policy, and the single `ai-coding-system` Cursor MCP entry.
- `.gitignore`
  - Ignores `providers/skills/` and `providers/refs/`.
  - Leaves `providers/registry.json` tracked.

## Installation run

Command:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:\AI-Coding-System\scripts\install-providers.ps1 -SkipHeavy
```

Installed:

- Context Mode `context-mode` (global npm)
- OpenCodeReview `@alibaba-group/open-code-review` (global npm)
- Ponytail shallow checkout
- Caveman shallow checkout
- OWASP Secure Coding Practices shallow checkout
- OWASP Top 10 shallow checkout

Soft-failed or intentionally deferred:

- Graphify: `uv` and `pipx` were unavailable; the Windows Python app alias
  returned exit 9009 during the `pip` fallback.
- Claude-Mem: intentionally prints
  `npx claude-mem install --provider host`; no sign-in was forced.
- Semgrep: skipped because `-SkipHeavy` was supplied.
- CodeQL and Bearer: not detected; manual installation only by design.

## Verification

- A second `-SkipHeavy` run exited 0 and reported npm packages and all
  checkouts as already present.
- Generated checkouts are ignored by Git.
- With the npm global bin directory on PATH, `ocr --version` reported
  OpenCodeReview 1.12.7 and `npm run doctor` reported OpenCodeReview,
  Ponytail, Caveman, OWASP SCP, and OWASP Top 10 as available.
- `git diff --check` passed.
- IDE lint diagnostics reported no errors in the changed files.

## Concerns

- Graphify remains unavailable until `uv`, `pipx`, or a real Python
  installation replaces the Windows Store app-execution alias.
- The npm global bin directory
  (`%APPDATA%\npm`) is added for the installer process, but users launching ACS
  elsewhere need that directory on their environment PATH for CLI detection.
- Context Mode has no local availability probe in the current provider status
  implementation, so doctor documents it as configured rather than proving its
  CLI is usable.

## Commit

`5b12075 feat: add provider install script and PROVIDERS docs`
