import type { SystemConfig } from "../core/config.js";
import { formatGitSummary, getGitSummary } from "../git/summary.js";
import {
  loadProjectMeta,
  resolveProjectId,
  type ProjectMeta,
} from "../project/register.js";
import {
  readArchitecture,
  readConstraints,
  readDecisions,
  readHandoff,
  readProjectState,
} from "../project/state.js";

export interface BuildContextArgs {
  projectId?: string;
  workspacePath?: string;
  includeGit?: boolean;
}

function trimBody(markdown: string, maxChars = 2500): string {
  const trimmed = markdown.trim();
  if (trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, maxChars)}\n\n…(truncated)`;
}

function extractSection(markdown: string, heading: string): string {
  const pattern = new RegExp(
    `## ${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`,
    "m",
  );
  const match = pattern.exec(markdown);
  return match?.[1]?.trim() ?? "";
}

export function buildProjectContext(
  config: SystemConfig,
  args: BuildContextArgs,
): { projectId: string; meta: ProjectMeta; context: string } {
  const projectId = resolveProjectId(config, args);
  const meta = loadProjectMeta(config, projectId);
  if (!meta) {
    throw new Error(`Project not found: ${projectId}`);
  }

  const state = readProjectState(config, projectId);
  const handoff = readHandoff(config, projectId);
  const decisions = readDecisions(config, projectId);
  const constraints = readConstraints(config, projectId);
  const architecture = readArchitecture(config, projectId);

  const currentWork =
    extractSection(state, "Current Work") ||
    extractSection(handoff, "Current task") ||
    "(none)";
  const nextAction = extractSection(state, "Next Action");
  const recent = extractSection(state, "Recent Changes");
  const tech = extractSection(state, "Technology");
  const knownIssues = extractSection(state, "Known Issues");
  const validation = extractSection(state, "Validation");

  const parts: string[] = [
    "[PROJECT]",
    `id: ${meta.projectId}`,
    `name: ${meta.projectName}`,
    `workspace: ${meta.workspacePath}`,
    `gitRemote: ${meta.gitRemote ?? "(none)"}`,
    `branch: ${meta.currentBranch ?? "(none)"}`,
    `identity: ${meta.identitySource}`,
    `updatedAt: ${meta.updatedAt}`,
    `lastEditor: ${meta.lastEditor ?? "(unknown)"}`,
    "",
    "[TECHNOLOGY]",
    trimBody(tech || "(unknown)", 800),
    "",
    "[ARCHITECTURE]",
    trimBody(architecture || extractSection(state, "Architecture") || "(none)", 1500),
    "",
    "[CURRENT]",
    `work: ${currentWork}`,
    `next: ${nextAction || "(see handoff remaining)"}`,
    "",
    "[HANDOFF]",
    trimBody(handoff, 2000),
    "",
    "[RECENT]",
    trimBody(recent || "(none)", 1000),
    "",
    "[CONSTRAINTS]",
    trimBody(constraints || extractSection(state, "Constraints") || "(none)", 1200),
    "",
    "[DECISIONS]",
    trimBody(decisions || extractSection(state, "Important Decisions") || "(none)", 1500),
    "",
    "[VALIDATION]",
    trimBody(validation || "(not run)", 500),
    "",
    "[KNOWN_ISSUES]",
    trimBody(knownIssues || "(none)", 800),
  ];

  if (args.includeGit !== false) {
    const git = getGitSummary(meta.workspacePath);
    parts.push("", "[GIT]", formatGitSummary(git));
  }

  parts.push(
    "",
    "[AGENT_HINT]",
    "Before coding: use this context. After meaningful work: call update_handoff.",
    "Do not dump the full repository into prompts. Prefer targeted file reads.",
  );

  return {
    projectId,
    meta,
    context: parts.join("\n"),
  };
}
