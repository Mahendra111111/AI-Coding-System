import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { SystemConfig } from "../core/config.js";

interface CommandError {
  stdout?: string;
  stderr?: string;
  message?: string;
}

interface PackageJson {
  scripts?: Record<string, unknown>;
}

function hasBuildScript(workspacePath: string): boolean {
  const packagePath = join(workspacePath, "package.json");
  if (!existsSync(packagePath)) return false;

  try {
    const pkg = JSON.parse(readFileSync(packagePath, "utf8")) as PackageJson;
    return typeof pkg.scripts?.build === "string" && pkg.scripts.build.trim() !== "";
  } catch {
    return false;
  }
}

function errorLines(output: string): string[] {
  return [
    ...new Set(
      output
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .filter((line) =>
          /(?:\berror\b|\bfailed\b|\bfailure\b|npm ERR!|TS\d{4})/i.test(line),
        ),
    ),
  ];
}

export function runBuildValidation(
  config: SystemConfig,
  workspacePath: string,
): string {
  if (!hasBuildScript(workspacePath)) {
    return "Build: skipped (no package.json scripts.build).";
  }

  const maxAttempts = Math.max(
    1,
    Math.floor(config.validation.maxBuildAttempts),
  );
  let lastErrors: string[] = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      execFileSync(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "build"], {
        cwd: workspacePath,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
        timeout: 300_000,
      });
      return `Build: passed (attempt ${attempt}/${maxAttempts}).`;
    } catch (error) {
      const commandError = error as CommandError;
      const output = [commandError.stdout, commandError.stderr]
        .filter((value): value is string => typeof value === "string")
        .join("\n");
      lastErrors = errorLines(output);
      if (lastErrors.length === 0) {
        lastErrors = errorLines(commandError.message ?? "");
      }
    }
  }

  return [
    `Build: failed after ${maxAttempts} attempt${maxAttempts === 1 ? "" : "s"}.`,
    ...(lastErrors.length > 0 ? lastErrors : ["Build command failed (no error lines returned)."]),
  ].join("\n");
}

export const runBuild = runBuildValidation;
