import { existsSync, readFileSync } from "node:fs";
import type { ChoiceAnswer } from "von-sdk";
import type { SystemConfig } from "../core/config.js";
import { projectStatePath } from "../core/paths.js";
import { resolveProjectId } from "../project/register.js";
import {
  choice,
  vonJudge,
  vonSystemOne,
} from "../providers/von.js";
import {
  type DecisionFamily,
  type DecisionToolId,
  FAMILY_CRITERIA,
  RETICLE_PEER,
  defaultToolForFamily,
  familyCriteriaRecord,
  getToolEntry,
  toolCriteriaRecord,
} from "./catalog.js";

const FAMILIES = Object.keys(FAMILY_CRITERIA) as DecisionFamily[];

function isDecisionFamily(value: string): value is DecisionFamily {
  return FAMILIES.includes(value as DecisionFamily);
}

function readProjectHint(
  config: SystemConfig,
  workspacePath?: string,
): string | undefined {
  if (!workspacePath) return undefined;
  try {
    const projectId = resolveProjectId(config, { workspacePath });
    const statePath = projectStatePath(config, projectId);
    if (!existsSync(statePath)) return undefined;
    const text = readFileSync(statePath, "utf8").trim();
    if (!text) return undefined;
    const firstLine =
      text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find((line) => line.length > 0 && !line.startsWith("#")) ?? text;
    return firstLine.slice(0, 240);
  } catch {
    return undefined;
  }
}

export function buildDecisionState(args: {
  task: string;
  hints?: string;
  projectHint?: string;
}): string {
  const parts = [`Task: ${args.task.trim()}`];
  if (args.hints?.trim()) parts.push(`Hints: ${args.hints.trim()}`);
  if (args.projectHint?.trim()) {
    parts.push(`Project: ${args.projectHint.trim()}`);
  }
  return parts.join("\n");
}

function asChoice(answer: unknown): ChoiceAnswer | undefined {
  if (!answer || typeof answer !== "object") return undefined;
  const a = answer as Partial<ChoiceAnswer>;
  if (a.type !== "choice" || typeof a.choice !== "string") return undefined;
  return a as ChoiceAnswer;
}

export interface DecideToolsResult {
  family: DecisionFamily | string;
  tool: DecisionToolId | string;
  confidence: number;
  probabilities: Record<string, number>;
  escalate: boolean;
  next: string;
  peer: typeof RETICLE_PEER | null;
  error?: string;
}

export async function decideTools(
  config: SystemConfig,
  args: { task: string; workspacePath?: string; hints?: string },
): Promise<DecideToolsResult> {
  const projectHint = readProjectHint(config, args.workspacePath);
  const state = buildDecisionState({
    task: args.task,
    hints: args.hints,
    projectHint,
  });

  const familyResult = await vonSystemOne(config, state, {
    family: choice(
      "Which ACS action family should the agent use next for this task?",
      familyCriteriaRecord(),
    ),
  });

  if (!familyResult.ok) {
    return {
      family: "no_tool",
      tool: "no_tool",
      confidence: 0,
      probabilities: {},
      escalate: true,
      next: "Von unavailable; pick an ACS tool manually or start the Von server",
      peer: null,
      error: familyResult.error,
    };
  }

  const familyAnswer = asChoice(familyResult.response.answers.family);
  if (!familyAnswer || !isDecisionFamily(familyAnswer.choice)) {
    return {
      family: familyAnswer?.choice ?? "unknown",
      tool: "no_tool",
      confidence: familyAnswer?.confidence ?? 0,
      probabilities: familyAnswer?.probabilities ?? {},
      escalate: true,
      next: "Von returned an unknown family; pick an ACS tool manually",
      peer: null,
    };
  }

  const family = familyAnswer.choice;
  const toolChoices = toolCriteriaRecord(family);
  const toolIds = Object.keys(toolChoices);

  let toolId: DecisionToolId | string = defaultToolForFamily(family).id;
  let toolConfidence = familyAnswer.confidence;
  let toolProbabilities = familyAnswer.probabilities;

  if (toolIds.length === 1) {
    toolId = toolIds[0]!;
  } else if (toolIds.length > 1) {
    const toolResult = await vonSystemOne(config, state, {
      tool: choice(
        `Within the ${family} family, which specific tool or action should run next?`,
        toolChoices,
      ),
    });
    if (toolResult.ok) {
      const toolAnswer = asChoice(toolResult.response.answers.tool);
      if (toolAnswer && toolIds.includes(toolAnswer.choice)) {
        toolId = toolAnswer.choice;
        toolConfidence = Math.min(
          familyAnswer.confidence,
          toolAnswer.confidence,
        );
        toolProbabilities = toolAnswer.probabilities;
      }
    }
  }

  const entry = getToolEntry(toolId) ?? defaultToolForFamily(family);
  const confidence = toolConfidence;
  const escalate = confidence < config.von.confidenceThreshold;

  return {
    family,
    tool: entry.id,
    confidence,
    probabilities: toolProbabilities,
    escalate,
    next: escalate
      ? `Low confidence (${confidence.toFixed(2)} < ${config.von.confidenceThreshold}); choose manually among ${family} tools`
      : entry.next,
    peer: entry.id === "reticle_verify" ? RETICLE_PEER : null,
  };
}

export interface DecideGateResult {
  noul?: number;
  escalate: boolean;
  error?: string;
}

export async function decideGate(
  config: SystemConfig,
  args: { state: string; question: string },
): Promise<DecideGateResult> {
  const result = await vonJudge(config, args.state, args.question);
  if (!result.ok) {
    return { escalate: true, error: result.error };
  }
  return {
    noul: result.noul,
    escalate: result.noul < config.von.confidenceThreshold,
  };
}
