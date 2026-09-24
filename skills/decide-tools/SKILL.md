---
name: decide-tools
description: >-
  When unsure which ACS tool to call next, use decide_tools (Von System One)
  then call only the recommended tool or Reticle peer flow.
---

# Decide tools (Von)

Call `decide_tools` with the current task before picking among ACS tools when
unsure. Follow the recommended tool unless `escalate` is true.

## Workflow

1. `decide_tools({ task, workspacePath?, hints? })`
2. If `escalate`: choose manually among the suggested family
3. If `tool` is `reticle_verify`: follow the Reticle peer skill (`skills/reticle`)
4. If `tool` is `seo_guidance`: call `seo_guidance` with user keywords, then install `next-seo` in the app and ship SEO with content
5. Otherwise call the named ACS tool only
6. Optional: `decide_gate` for yes/no confidence gates

## MCP tools

- `decide_tools`, `decide_gate`
- Downstream ACS tools named in the decision response
- Peer Reticle tools when `peer.mcp === "reticle"`
