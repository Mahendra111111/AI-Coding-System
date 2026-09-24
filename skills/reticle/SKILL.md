---
name: reticle
description: >-
  Verify owned running web/desktop apps with Reticle peer MCP. Use when the
  agent claims a UI change is done and needs pass/fail with file:line evidence.
---

# Reticle (peer MCP)

Reticle is **not** proxied through ACS. Register the peer server once, wire the
dev-only SDK in the **app** you own, then drive verification with `reticle_*`
tools.

## When to use

- You own the React/Next (or supported) app and it is running locally
- You need runtime truth (network, store, console), not screenshots
- ACS `decide_tools` recommended `verify_ui` / `reticle_verify`

## Setup (once per machine + once per app)

1. Machine: `npm install -g @reticlehq/server` then `npx @reticlehq/server setup mcp`
2. App workspace: `npx @reticlehq/server init`
3. Confirm: `npx @reticlehq/server doctor` or ask whether Reticle is connected

## Verification loop

1. `reticle_snapshot({ mode: "interactive" })` once for the flow
2. `reticle_act_sequence` for setup fills and intermediate clicks (one call)
3. `reticle_act_and_wait({ ref, action, until })` for the **final** step only — name the expected consequence in `until` **before** acting
4. `reticle_state()` once at the end

**Only `reticle_act_and_wait` and `reticle_assert` produce a verdict.** Ending without one of those is incomplete.

## MCP tools

- Peer: `reticle_*` via `npx @reticlehq/server mcp`
- ACS: `decide_tools` (when unsure), `reticle_guidance` (checklist + status), `provider_status`

## Output

Report pass / fail / couldn't tell with evidence and any `file:line` Reticle returns. Do not claim UI work is done without a verdict.
