import { existsSync, readFileSync } from "node:fs";
import { atomicWriteFile } from "../core/atomicWrite.js";
import type { SystemConfig } from "../core/config.js";
import {
  architecturePath,
  constraintsPath,
  decisionsPath,
  handoffPath,
  projectStatePath,
} from "../core/paths.js";
import { loadProjectMeta, type ProjectMeta } from "./register.js";

export function readTextFile(path: string): string {
  if (!existsSync(path)) return "";
  return readFileSync(path, "utf8");
}

export function readHandoff(config: SystemConfig, projectId: string): string {
  return readTextFile(handoffPath(config, projectId));
}

export function readProjectState(config: SystemConfig, projectId: string): string {
  return readTextFile(projectStatePath(config, projectId));
}

export function readDecisions(config: SystemConfig, projectId: string): string {
  return readTextFile(decisionsPath(config, projectId));
}

export function readConstraints(config: SystemConfig, projectId: string): string {
  return readTextFile(constraintsPath(config, projectId));
}

export function readArchitecture(config: SystemConfig, projectId: string): string {
  return readTextFile(architecturePath(config, projectId));
}

export interface HandoffUpdate {
  currentTask?: string;
  completed?: string[];
  filesChanged?: string[];
  decision?: string;
  validation?: string;
  remaining?: string;
  editor?: string;
}

export function updateHandoff(
  config: SystemConfig,
  projectId: string,
  update: HandoffUpdate,
): string {
  const existing = readHandoff(config, projectId);
  const meta = loadProjectMeta(config, projectId);
  const content = renderHandoff(existing, update, meta);
  atomicWriteFile(handoffPath(config, projectId), content);
  return content;
}

function sectionOr(
  updateValue: string | undefined,
  fallbackBlock: string,
): string {
  if (updateValue !== undefined && updateValue.trim().length > 0) {
    return updateValue.trim();
  }
  return fallbackBlock.trim();
}

function listOr(
  items: string[] | undefined,
  fallbackBlock: string,
): string {
  if (items && items.length > 0) {
    return items.map((i) => `* ${i}`).join("\n");
  }
  return fallbackBlock.trim() || "* (none)";
}

function extractAfter(label: string, text: string, untilLabels: string[]): string {
  const start = text.indexOf(label);
  if (start < 0) return "";
  const after = text.slice(start + label.length);
  let end = after.length;
  for (const u of untilLabels) {
    const idx = after.indexOf(u);
    if (idx >= 0 && idx < end) end = idx;
  }
  return after.slice(0, end).trim();
}

function renderHandoff(
  existing: string,
  update: HandoffUpdate,
  meta: ProjectMeta | null,
): string {
  const labels = [
    "Current task:",
    "Completed:",
    "Files changed:",
    "Decision:",
    "Validation:",
    "Remaining:",
    "Updated:",
    "Editor:",
  ];

  const currentTask = sectionOr(
    update.currentTask,
    extractAfter("Current task:", existing, labels.filter((l) => l !== "Current task:")),
  );
  const completed = listOr(
    update.completed,
    extractAfter("Completed:", existing, labels.filter((l) => l !== "Completed:")),
  );
  const filesChanged = listOr(
    update.filesChanged,
    extractAfter("Files changed:", existing, labels.filter((l) => l !== "Files changed:")),
  );
  const decision = sectionOr(
    update.decision,
    extractAfter("Decision:", existing, labels.filter((l) => l !== "Decision:")),
  );
  const validation = sectionOr(
    update.validation,
    extractAfter("Validation:", existing, labels.filter((l) => l !== "Validation:")),
  );
  const remaining = sectionOr(
    update.remaining,
    extractAfter("Remaining:", existing, labels.filter((l) => l !== "Remaining:")),
  );

  return `# Handoff

Current task: ${currentTask || "(none)"}

Completed:

${completed}

Files changed:

${filesChanged}

Decision:
${decision || "(none)"}

Validation:
${validation || "(not run)"}

Remaining:
${remaining || "(none)"}

Updated: ${new Date().toISOString()}
Editor: ${update.editor ?? meta?.lastEditor ?? "(unknown)"}
`;
}

export interface ProjectStateUpdate {
  technology?: string;
  architecture?: string;
  currentWork?: string;
  recentChanges?: string;
  importantDecisions?: string;
  constraints?: string;
  validation?: string;
  knownIssues?: string;
  nextAction?: string;
  appendDecision?: string;
  appendConstraint?: string;
}

function replaceSection(
  markdown: string,
  heading: string,
  body: string | undefined,
): string {
  if (body === undefined) return markdown;
  const pattern = new RegExp(
    `(## ${escapeRegExp(heading)}\\s*\\n)([\\s\\S]*?)(?=\\n## |$)`,
    "m",
  );
  if (!pattern.test(markdown)) {
    return `${markdown.trimEnd()}\n\n## ${heading}\n\n${body.trim()}\n`;
  }
  return markdown.replace(pattern, `$1\n${body.trim()}\n\n`);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function updateProjectState(
  config: SystemConfig,
  projectId: string,
  update: ProjectStateUpdate,
): { projectState: string; decisions?: string; constraints?: string } {
  let state = readProjectState(config, projectId);
  state = replaceSection(state, "Technology", update.technology);
  state = replaceSection(state, "Architecture", update.architecture);
  state = replaceSection(state, "Current Work", update.currentWork);
  state = replaceSection(state, "Recent Changes", update.recentChanges);
  state = replaceSection(state, "Important Decisions", update.importantDecisions);
  state = replaceSection(state, "Constraints", update.constraints);
  state = replaceSection(state, "Validation", update.validation);
  state = replaceSection(state, "Known Issues", update.knownIssues);
  state = replaceSection(state, "Next Action", update.nextAction);
  atomicWriteFile(projectStatePath(config, projectId), state);

  const result: {
    projectState: string;
    decisions?: string;
    constraints?: string;
  } = { projectState: state };

  if (update.appendDecision) {
    const stamp = new Date().toISOString().slice(0, 10);
    const next = `${readDecisions(config, projectId).trimEnd()}\n\n## ${stamp}\n${update.appendDecision.trim()}\n`;
    atomicWriteFile(decisionsPath(config, projectId), next);
    result.decisions = next;
  }

  if (update.appendConstraint) {
    const next = `${readConstraints(config, projectId).trimEnd()}\n\n- ${update.appendConstraint.trim()}\n`;
    atomicWriteFile(constraintsPath(config, projectId), next);
    result.constraints = next;
  }

  if (update.architecture !== undefined) {
    atomicWriteFile(
      architecturePath(config, projectId),
      `# Architecture\n\n${update.architecture.trim()}\n`,
    );
  }

  return result;
}
