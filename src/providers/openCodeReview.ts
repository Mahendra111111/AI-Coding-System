import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { SystemConfig } from "../core/config.js";
import { reviewsDir } from "../core/paths.js";
import { cliAvailable } from "./which.js";

const MAX_SUMMARY_CHARS = 4000;

export type OpenCodeReviewMode = "diff" | "scan";

export interface OpenCodeReviewOptions {
  workspacePath: string;
  projectId: string;
  mode: OpenCodeReviewMode;
}

function commandForMode(mode: OpenCodeReviewMode): string {
  switch (mode) {
    case "diff":
      return "review";
    case "scan":
      return "scan";
    default: {
      const _exhaustive: never = mode;
      return _exhaustive;
    }
  }
}

function timestampForFilename(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function truncate(text: string): string {
  if (text.length <= MAX_SUMMARY_CHARS) return text;
  return `${text.slice(0, MAX_SUMMARY_CHARS - 1)}…`;
}

export function runOpenCodeReview(
  config: SystemConfig,
  options: OpenCodeReviewOptions,
): string {
  if (!cliAvailable("ocr")) {
    return "OpenCodeReview is not installed. Install: npm install -g @alibaba-group/open-code-review";
  }

  const command = commandForMode(options.mode);
  const outputDir = reviewsDir(config, options.projectId);
  mkdirSync(outputDir, { recursive: true });

  let output: string;
  try {
    output = execFileSync("ocr", [command, "--format", "json"], {
      cwd: options.workspacePath,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      timeout: 300_000,
    }).trim();
  } catch (error) {
    const executionError = error as {
      stdout?: string;
      stderr?: string;
      message?: string;
    };
    output = [
      executionError.stdout?.trim(),
      executionError.stderr?.trim(),
      executionError.message,
    ]
      .filter(Boolean)
      .join("\n");
  }

  const result = output || "{}";
  const outputPath = join(
    outputDir,
    `open-code-review-${options.mode}-${timestampForFilename()}.json`,
  );
  writeFileSync(outputPath, result, "utf8");

  return `Review saved: ${outputPath}\n\n${truncate(result)}`;
}
