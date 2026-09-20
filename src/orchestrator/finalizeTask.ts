import { existsSync, rmSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import type { SystemConfig, SecurityPolicy } from "../core/config.js";
import { projectDir, projectsDir, tempSessionDir } from "../core/paths.js";
import { formatGitSummary, getGitSummary } from "../git/summary.js";
import { resolveProjectId } from "../project/register.js";
import { updateHandoff, type HandoffUpdate } from "../project/state.js";
import { runOpenCodeReview } from "../providers/openCodeReview.js";
import { runQualityCheck } from "../providers/quality.js";
import { runSecurityScan } from "../security/scan.js";
import { runBuildValidation } from "../validation/build.js";

export interface FinalizeTaskArgs extends HandoffUpdate {
  workspacePath: string;
  projectId?: string;
  sessionId?: string;
  qualityCheck?: boolean;
  securityScan?: boolean;
  securityPolicy?: SecurityPolicy;
  review?: boolean;
  handoff?: HandoffUpdate;
}

function checklistItem(
  complete: boolean,
  label: string,
  detail: string,
): string {
  const indented = detail
    .trim()
    .split(/\r?\n/)
    .map((line) => `   ${line}`)
    .join("\n");
  return `- [${complete ? "x" : " "}] ${label}\n${indented}`;
}

function requestedHandoff(args: FinalizeTaskArgs): HandoffUpdate | null {
  const direct: HandoffUpdate = {
    currentTask: args.currentTask,
    completed: args.completed,
    filesChanged: args.filesChanged,
    decision: args.decision,
    validation: args.validation,
    remaining: args.remaining,
    editor: args.editor,
  };
  const merged = { ...direct, ...args.handoff };
  return Object.values(merged).some((value) => value !== undefined)
    ? merged
    : null;
}

function managedTempPath(
  config: SystemConfig,
  projectId: string,
  sessionId: string,
): string | null {
  if (
    !/^[A-Za-z0-9._-]+$/.test(sessionId) ||
    sessionId === "." ||
    sessionId === ".."
  ) {
    return null;
  }

  const projectsRoot = resolve(projectsDir(config));
  const projectRoot = resolve(projectDir(config, projectId));
  const tempPath = resolve(tempSessionDir(config, projectId, sessionId));
  const projectRelative = relative(projectsRoot, projectRoot);
  const tempRelative = relative(projectRoot, tempPath);
  if (
    !projectRelative ||
    projectRelative.startsWith("..") ||
    isAbsolute(projectRelative) ||
    !tempRelative ||
    tempRelative.startsWith("..") ||
    isAbsolute(tempRelative)
  ) {
    return null;
  }
  return tempPath;
}

export function finalizeTask(
  config: SystemConfig,
  args: FinalizeTaskArgs,
): string {
  const report: string[] = ["# Finalize task"];
  let resolvedProjectId: string | undefined;
  const getProjectId = (): string => {
    resolvedProjectId ??= resolveProjectId(config, {
      workspacePath: args.workspacePath,
      projectId: args.projectId,
    });
    return resolvedProjectId;
  };

  report.push(
    checklistItem(
      true,
      "Git summary",
      formatGitSummary(getGitSummary(args.workspacePath)),
    ),
  );

  const build = runBuildValidation(config, args.workspacePath);
  report.push(checklistItem(!build.startsWith("Build: failed"), "Build", build));

  if (args.qualityCheck === true) {
    report.push(
      checklistItem(true, "Quality check", runQualityCheck(args.workspacePath)),
    );
  } else {
    report.push(checklistItem(false, "Quality check", "Skipped: not requested."));
  }

  if (args.securityScan === true) {
    report.push(
      checklistItem(
        true,
        "Security scan",
        runSecurityScan(config, {
          workspacePath: args.workspacePath,
          policy: args.securityPolicy,
        }),
      ),
    );
  } else {
    report.push(checklistItem(false, "Security scan", "Skipped: not requested."));
  }

  if (args.review === true && config.review.openCodeReview.enabled) {
    report.push(
      checklistItem(
        true,
        "Review",
        runOpenCodeReview(config, {
          workspacePath: args.workspacePath,
          projectId: getProjectId(),
          mode: "diff",
        }),
      ),
    );
  } else {
    const reason =
      args.review === true ? "disabled in configuration" : "not requested";
    report.push(checklistItem(false, "Review", `Skipped: ${reason}.`));
  }

  const handoff = requestedHandoff(args);
  if (handoff) {
    updateHandoff(config, getProjectId(), handoff);
    report.push(checklistItem(true, "Handoff", "Updated provided fields."));
  } else {
    report.push(checklistItem(false, "Handoff", "Skipped: no fields provided."));
  }

  if (args.sessionId !== undefined) {
    const path = managedTempPath(config, getProjectId(), args.sessionId);
    if (!path) {
      report.push(
        checklistItem(
          false,
          "Session cleanup",
          "Refused: session path is outside the managed project temp tree.",
        ),
      );
    } else {
      if (existsSync(path)) rmSync(path, { recursive: true, force: true });
      report.push(checklistItem(true, "Session cleanup", `Cleaned: ${path}`));
    }
  } else {
    report.push(
      checklistItem(false, "Session cleanup", "Skipped: no sessionId provided."),
    );
  }

  return report.join("\n\n");
}
