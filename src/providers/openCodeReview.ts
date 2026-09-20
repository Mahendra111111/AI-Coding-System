import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import type { SystemConfig } from "../core/config.js";
import { projectsDir, reviewsDir } from "../core/paths.js";
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

function safeReviewsDir(config: SystemConfig, projectId: string): string {
  if (
    !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(projectId) ||
    projectId === "." ||
    projectId === ".."
  ) {
    throw new Error("Invalid projectId: expected safe letters, digits, '.', '_' or '-' only.");
  }

  const root = resolve(projectsDir(config));
  const outputDir = resolve(reviewsDir(config, projectId));
  const fromRoot = relative(root, outputDir);
  if (!fromRoot || fromRoot.startsWith("..") || isAbsolute(fromRoot)) {
    throw new Error("Refused review path outside the managed projects directory.");
  }
  return outputDir;
}

export function runOpenCodeReview(
  config: SystemConfig,
  options: OpenCodeReviewOptions,
): string {
  const outputDir = safeReviewsDir(config, options.projectId);
  if (!cliAvailable("ocr")) {
    return "OpenCodeReview is not installed. Install: npm install -g @alibaba-group/open-code-review";
  }

  const command = commandForMode(options.mode);
  mkdirSync(outputDir, { recursive: true });

  let output: string;
  let succeeded = true;
  try {
    output = execFileSync("ocr", [command, "--format", "json"], {
      cwd: options.workspacePath,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      timeout: 300_000,
    }).trim();
  } catch (error) {
    succeeded = false;
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

  return succeeded
    ? `Review saved: ${outputPath}\n\n${truncate(result)}`
    : `Review failed; diagnostic saved: ${outputPath}\n\n${truncate(result)}`;
}
