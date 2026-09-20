import type { SystemConfig } from "../core/config.js";
import { buildProjectContext } from "../context/buildContext.js";
import { getGitSummary } from "../git/summary.js";
import {
  graphQuery,
  isGraphifyAvailable,
} from "../graph/graphify.js";
import { registerProject } from "../project/register.js";
import { memorySearch } from "../providers/claudeMem.js";
import { securityRefs, type SecurityTopic } from "../providers/owasp.js";

const MAX_CONTEXT_CHARS = 8_000;

export interface PrepareContextArgs {
  workspacePath: string;
  task: string;
  includeMemory?: boolean;
  includeGraph?: boolean;
}

interface ContextSection {
  tag: string;
  body: string;
  maxChars: number;
}

function truncate(text: string, maxChars: number): string {
  const compact = text.trim();
  if (!compact) return "(none)";
  if (compact.length <= maxChars) return compact;
  return `${compact.slice(0, Math.max(0, maxChars - 14)).trimEnd()}\n…(truncated)`;
}

function extractTaggedSection(context: string, tag: string): string {
  const marker = `[${tag}]`;
  const start = context.indexOf(marker);
  if (start < 0) return "";
  const bodyStart = start + marker.length;
  const next = context.indexOf("\n[", bodyStart);
  return context.slice(bodyStart, next < 0 ? undefined : next).trim();
}

function extractAcceptanceCriteria(task: string): string {
  const heading = /(?:^|\n)\s*(?:#{1,6}\s*)?(?:acceptance criteria|criteria|requirements)\s*:?\s*\n/i;
  const match = heading.exec(task);
  if (match?.index !== undefined) {
    const after = task.slice(match.index + match[0].length);
    const nextHeading = after.search(/\n\s*#{1,6}\s+\S/);
    const criteria = after.slice(0, nextHeading < 0 ? undefined : nextHeading).trim();
    if (criteria) return criteria;
  }

  const checklist = task
    .split(/\r?\n/)
    .filter((line) => /^\s*(?:[-*]\s+\[[ xX]\]|(?:must|should)\b)/i.test(line))
    .join("\n");
  return checklist || "(not separately provided)";
}

function relevantErrors(projectContext: string): string {
  const candidates = [
    extractTaggedSection(projectContext, "VALIDATION"),
    extractTaggedSection(projectContext, "KNOWN_ISSUES"),
  ].filter(
    (value) =>
      value &&
      !/^(?:\(not run\)|\(none\)|none\.?|not run\.?)$/i.test(value.trim()),
  );
  return candidates.join("\n\n") || "(none recorded)";
}

function securityTopic(task: string): SecurityTopic | null {
  const lower = task.toLowerCase();
  if (/\b(auth|login|password|credential|identity)\b/.test(lower)) return "auth";
  if (/\b(session|cookie|jwt|token|logout)\b/.test(lower)) return "session";
  if (/\b(sql|xss|injection|command execution)\b/.test(lower)) return "injection";
  if (/\b(permission|authorization|access control|rbac|privilege)\b/.test(lower)) {
    return "access-control";
  }
  if (/\b(encrypt|decrypt|crypto|hash|cipher|tls|certificate)\b/.test(lower)) {
    return "crypto";
  }
  if (/\b(validate|validation|sanitize|user input)\b/.test(lower)) {
    return "input-validation";
  }
  if (/\b(config|configuration|secret|environment variable)\b/.test(lower)) {
    return "config";
  }
  if (/\b(security|secure|vulnerability|owasp)\b/.test(lower)) return "general";
  return null;
}

function formatModifiedFiles(workspacePath: string): string {
  const git = getGitSummary(workspacePath);
  if (!git.available) return `Git unavailable: ${git.error ?? "unknown error"}`;
  const files = [...new Set([...git.stagedFiles, ...git.dirtyFiles])];
  return files.length ? files.map((file) => `- ${file}`).join("\n") : "(none)";
}

function assemble(sections: ContextSection[]): string {
  const parts: string[] = [];
  for (const section of sections) {
    parts.push(`[${section.tag}]\n${truncate(section.body, section.maxChars)}`);
  }
  const context = parts.join("\n\n");
  return context.length <= MAX_CONTEXT_CHARS
    ? context
    : `${context.slice(0, MAX_CONTEXT_CHARS - 14).trimEnd()}\n…(truncated)`;
}

export async function prepareContext(
  config: SystemConfig,
  args: PrepareContextArgs,
): Promise<string> {
  registerProject(config, { workspacePath: args.workspacePath });
  const projectContext = buildProjectContext(config, {
    workspacePath: args.workspacePath,
    includeGit: false,
  }).context;

  const topic = securityTopic(args.task);
  const security = topic
    ? securityRefs(config, topic, 650)
    : "(no task-specific security context identified)";

  let graph = "(not requested or unavailable)";
  if (
    args.includeGraph === true &&
    config.graphify.enabled &&
    isGraphifyAvailable()
  ) {
    try {
      graph = graphQuery(args.workspacePath, truncate(args.task, 500));
    } catch (error) {
      graph = `Graphify query failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  let extra = "(none)";
  if (args.includeMemory === true && config.memory.enabled) {
    extra = await memorySearch(config, truncate(args.task, 500), 5);
  }

  return assemble([
    { tag: "TASK", body: args.task, maxChars: 1_400 },
    {
      tag: "ACCEPTANCE_CRITERIA",
      body: extractAcceptanceCriteria(args.task),
      maxChars: 800,
    },
    {
      tag: "MODIFIED_FILES",
      body: formatModifiedFiles(args.workspacePath),
      maxChars: 900,
    },
    { tag: "ERRORS", body: relevantErrors(projectContext), maxChars: 700 },
    { tag: "SECURITY", body: security, maxChars: 650 },
    {
      tag: "ARCHITECTURE",
      body: extractTaggedSection(projectContext, "ARCHITECTURE"),
      maxChars: 800,
    },
    {
      tag: "CONSTRAINTS",
      body: extractTaggedSection(projectContext, "CONSTRAINTS"),
      maxChars: 600,
    },
    {
      tag: "DECISIONS",
      body: extractTaggedSection(projectContext, "DECISIONS"),
      maxChars: 600,
    },
    { tag: "GRAPHIFY", body: graph, maxChars: 550 },
    { tag: "EXTRA", body: extra, maxChars: 450 },
  ]);
}
