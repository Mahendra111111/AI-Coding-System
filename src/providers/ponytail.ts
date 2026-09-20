import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { SystemConfig } from "../core/config.js";

const PONYTAIL_CHECKOUT = "providers/skills/ponytail";

const DISCIPLINE_LADDER = `Ponytail implementation discipline (ACS compact copy)

Before writing code, stop at the first rung that holds. Read the task and the code it touches first; trace the real flow, then climb.

1. Does this need to exist? → no: skip it (YAGNI)
2. Already in this codebase? → reuse it, don't rewrite
3. Stdlib does it? → use it
4. Native platform feature? → use it
5. Installed dependency solves it? → use it
6. One line? → one line
7. Only then: the minimum code that works

Safety carve-outs (never cut):
- Input validation at trust boundaries
- Error handling that prevents data loss
- Security controls
- Accessibility requirements
- Correctness and anything explicitly requested

Lazy about the solution, never about reading. Mark intentional shortcuts with a ponytail: comment naming the ceiling and upgrade path.`;

export function getDisciplineRules(config: SystemConfig): string {
  if (!config.ponytail.enabled) {
    return "Ponytail discipline rules are disabled in config/system.json. Enable ponytail.enabled to use the implementation-discipline guidance.";
  }

  const checkout = resolve(config.systemRoot, PONYTAIL_CHECKOUT);
  if (existsSync(checkout)) {
    return `${DISCIPLINE_LADDER}\n\nPonytail checkout: ${checkout}\nInstall Cursor hooks: node ${resolve(checkout, "scripts/cursor-hooks.js")} install`;
  }
  return `${DISCIPLINE_LADDER}\n\nPonytail checkout not found. Install: git clone --depth 1 https://github.com/DietrichGebert/ponytail.git ${checkout}`;
}
