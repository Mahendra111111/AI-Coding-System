# Final whole-branch review package
BASE: 753e16c04f8e3e1336228709059878d7977b638f (Task 0 baseline)
HEAD: 797dce3a74672329beb6683b3a371e5d0bcb8d41

## Commits (15)
797dce3 chore: verify provider MCP facade P0-P5
558234b docs: wire editor guidance to provider facade tools
8a7e3ff feat: finalize_task end-of-task workflow
464c92c feat: prepare_context orchestrator
684afce feat: security scan orchestrator (semgrep-first)
f67ad5e feat: selective claude-mem memory tools (non-SoT)
248916c feat: OpenCodeReview provider writing to projects/<id>/reviews
b9c096e feat: quality detect and check for prettier eslint biome
e786efe feat: task-scoped OWASP security refs tool
adb605d feat: expose ponytail discipline and compression guidance tools
5b12075 feat: add provider install script and PROVIDERS docs
4b55ae9 feat: provider status surface in doctor and MCP
f2a89cb feat: add provider registry and path helpers
f273688 feat: enforce contextMode XOR caveman compression policy
59a1da1 feat: extend system config with provider toggles

## Stat
 .gitignore                                         |   3 +
 .superpowers/sdd/task-12-report.md                 |  26 ++
 .superpowers/sdd/task-13-report.md                 |  27 ++
 .superpowers/sdd/task-14-report.md                 |  21 ++
 .superpowers/sdd/task-15-report.md                 |  37 +++
 .superpowers/sdd/task-7-report.md                  |  42 +++
 .superpowers/sdd/task-8-report.md                  |  29 ++
 .superpowers/sdd/task-9-report.md                  |  15 ++
 config/system.json                                 |  33 +++
 docs/ARCHITECTURE.md                               |  27 +-
 docs/CONNECT-EDITORS.md                            |  17 +-
 docs/PROVIDERS.md                                  |  37 +++
 .../specs/2026-09-20-provider-mcp-facade-design.md |   2 +-
 examples/cursor-rule.mdc                           |  28 +-
 providers/registry.json                            | 102 +++++++
 providers/skills/README.md                         |  40 +++
 scripts/install-providers.ps1                      | 216 +++++++++++++++
 skills/README.md                                   |  29 ++
 skills/_template/SKILL.md                          |  29 ++
 src/core/config.ts                                 |  45 +++-
 src/core/paths.ts                                  |  16 ++
 src/doctor.ts                                      |  26 +-
 src/mcp/tools.ts                                   | 191 ++++++++++++-
 src/orchestrator/finalizeTask.ts                   | 179 +++++++++++++
 src/orchestrator/prepareContext.ts                 | 176 ++++++++++++
 src/providers/caveman.ts                           |  24 ++
 src/providers/claudeMem.ts                         |  72 +++++
 src/providers/compression.ts                       |  26 ++
 src/providers/openCodeReview.ts                    |  84 ++++++
 src/providers/owasp.ts                             | 295 +++++++++++++++++++++
 src/providers/ponytail.ts                          |  34 +++
 src/providers/quality.ts                           | 292 ++++++++++++++++++++
 src/providers/registry.ts                          |  17 ++
 src/providers/status.ts                            |  94 +++++++
 src/providers/types.ts                             |  26 ++
 src/providers/which.ts                             |  15 ++
 src/security/scan.ts                               | 189 +++++++++++++
 src/validation/build.ts                            |  84 ++++++
 tests/claude-mem.test.ts                           |  93 +++++++
 tests/compression.test.ts                          |  56 ++++
 tests/config-providers.test.ts                     |  19 ++
 tests/discipline-rules.test.ts                     |  71 +++++
 tests/finalize-task.test.ts                        | 129 +++++++++
 tests/identity-context.test.ts                     |  45 ++++
 tests/owasp-refs.test.ts                           | 117 ++++++++
 tests/prepare-context.test.ts                      | 165 ++++++++++++
 tests/provider-registry.test.ts                    |  49 ++++
 tests/provider-status.test.ts                      |  32 +++
 tests/quality-detect.test.ts                       | 139 ++++++++++
 tests/review-paths.test.ts                         | 129 +++++++++
 tests/security-scan.test.ts                        | 137 ++++++++++
 51 files changed, 3813 insertions(+), 13 deletions(-)

## Name-status
M	.gitignore
A	.superpowers/sdd/task-12-report.md
A	.superpowers/sdd/task-13-report.md
A	.superpowers/sdd/task-14-report.md
A	.superpowers/sdd/task-15-report.md
A	.superpowers/sdd/task-7-report.md
A	.superpowers/sdd/task-8-report.md
A	.superpowers/sdd/task-9-report.md
M	config/system.json
M	docs/ARCHITECTURE.md
M	docs/CONNECT-EDITORS.md
A	docs/PROVIDERS.md
M	docs/superpowers/specs/2026-09-20-provider-mcp-facade-design.md
M	examples/cursor-rule.mdc
A	providers/registry.json
A	providers/skills/README.md
A	scripts/install-providers.ps1
A	skills/README.md
A	skills/_template/SKILL.md
M	src/core/config.ts
M	src/core/paths.ts
M	src/doctor.ts
M	src/mcp/tools.ts
A	src/orchestrator/finalizeTask.ts
A	src/orchestrator/prepareContext.ts
A	src/providers/caveman.ts
A	src/providers/claudeMem.ts
A	src/providers/compression.ts
A	src/providers/openCodeReview.ts
A	src/providers/owasp.ts
A	src/providers/ponytail.ts
A	src/providers/quality.ts
A	src/providers/registry.ts
A	src/providers/status.ts
A	src/providers/types.ts
A	src/providers/which.ts
A	src/security/scan.ts
A	src/validation/build.ts
A	tests/claude-mem.test.ts
A	tests/compression.test.ts
A	tests/config-providers.test.ts
A	tests/discipline-rules.test.ts
A	tests/finalize-task.test.ts
M	tests/identity-context.test.ts
A	tests/owasp-refs.test.ts
A	tests/prepare-context.test.ts
A	tests/provider-registry.test.ts
A	tests/provider-status.test.ts
A	tests/quality-detect.test.ts
A	tests/review-paths.test.ts
A	tests/security-scan.test.ts

## Minor findings ledger (from SDD)
See .superpowers/sdd/progress.md

## Spec
docs/superpowers/specs/2026-09-20-provider-mcp-facade-design.md
## Plan
docs/superpowers/plans/2026-09-20-provider-mcp-facade.md
