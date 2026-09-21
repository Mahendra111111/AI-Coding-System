import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { SecurityPolicy, SystemConfig } from "../core/config.js";
import { cliAvailable } from "../providers/which.js";

const MAX_FINDINGS_CHARS = 3000;

export interface SecurityScanOptions {
  workspacePath: string;
  policy?: SecurityPolicy;
}

interface CommandError {
  stdout?: string;
  stderr?: string;
  message?: string;
}

function truncate(text: string): string {
  if (text.length <= MAX_FINDINGS_CHARS) return text;
  return `${text.slice(0, MAX_FINDINGS_CHARS - 1)}…`;
}

function compactJson(output: string): string {
  try {
    const parsed = JSON.parse(output) as {
      results?: Array<{
        check_id?: string;
        path?: string;
        start?: { line?: number };
        extra?: {
          message?: string;
          severity?: string;
        };
        rule?: { id?: string };
        filename?: string;
        line_number?: number;
        title?: string;
        description?: string;
        severity?: string;
      }>;
      findings?: Array<Record<string, unknown>>;
    };
    const findings = parsed.results ?? parsed.findings;
    if (!Array.isArray(findings)) {
      return "Scan completed; structured output contained no findings list.";
    }
    if (findings.length === 0) return "No findings.";

    return findings
      .map((finding, index) => {
        const semgrep = finding as NonNullable<typeof parsed.results>[number];
        const location = semgrep.path ?? semgrep.filename ?? "unknown";
        const line = semgrep.start?.line ?? semgrep.line_number;
        const rule = semgrep.check_id ?? semgrep.rule?.id ?? semgrep.title;
        const message = semgrep.extra?.message ?? semgrep.description;
        const severity = semgrep.extra?.severity ?? semgrep.severity;
        return [
          `${index + 1}. ${location}${line ? `:${line}` : ""}`,
          rule ? `[${rule}]` : "",
          severity ? `(${severity})` : "",
          message ?? "Finding reported",
        ]
          .filter(Boolean)
          .join(" ");
      })
      .join("\n");
  } catch {
    return output.trim() || "Scan completed with no output.";
  }
}

function runTool(
  label: string,
  command: string,
  args: string[],
  workspacePath: string,
  structuredJson: boolean,
): string {
  try {
    const output = execFileSync(command, args, {
      cwd: workspacePath,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      timeout: 300_000,
    }).trim();
    const findings = structuredJson ? compactJson(output) : output || "No findings.";
    return `=== ${label} ===\n${findings}`;
  } catch (error) {
    const executionError = error as CommandError;
    const output = [executionError.stdout, executionError.stderr]
      .filter(Boolean)
      .join("\n")
      .trim();
    const findings = structuredJson ? compactJson(output) : output;
    return `=== ${label} ===\nFailed: ${findings || executionError.message || "Scan failed."}`;
  }
}

function toolDirs(config: SystemConfig, cli: string): string[] {
  return [resolve(config.systemRoot, "tools", cli)];
}

function semgrepSection(config: SystemConfig, workspacePath: string): string {
  if (!config.security.semgrep.enabled) {
    return "=== Semgrep ===\nSkipped: disabled in configuration.";
  }
  if (!cliAvailable("semgrep", toolDirs(config, "semgrep"))) {
    return "=== Semgrep ===\nSkipped: CLI unavailable.";
  }
  return runTool(
    "Semgrep",
    "semgrep",
    ["scan", "--config", "auto", "--json", "."],
    workspacePath,
    true,
  );
}

function reviewNote(): string {
  return "=== Review ===\nRun review_diff or review_scan for human-oriented security review.";
}

function deepSections(config: SystemConfig, workspacePath: string): string[] {
  const sections: string[] = [];
  const configuredDatabase = process.env.CODEQL_DATABASE?.trim();
  const defaultDatabase = resolve(workspacePath, "codeql-db");
  const codeqlDatabase =
    configuredDatabase && existsSync(configuredDatabase)
      ? resolve(configuredDatabase)
      : existsSync(defaultDatabase)
        ? defaultDatabase
        : null;

  if (!config.security.codeql.enabled) {
    sections.push("=== CodeQL ===\nSkipped: disabled in configuration.");
  } else if (!cliAvailable("codeql", toolDirs(config, "codeql"))) {
    sections.push("=== CodeQL ===\nSkipped: CLI unavailable.");
  } else if (!codeqlDatabase) {
    sections.push(
      "=== CodeQL ===\nSkipped: no prepared CodeQL database. Create one with `codeql database create <database-path> --source-root <workspace>` and set CODEQL_DATABASE to that path, or place it at <workspace>/codeql-db.",
    );
  } else {
    sections.push(
      runTool(
        "CodeQL",
        "codeql",
        [
          "database",
          "analyze",
          codeqlDatabase,
          "--format=csv",
          "--output=-",
        ],
        workspacePath,
        false,
      ),
    );
  }

  return sections;
}

export function runSecurityScan(
  config: SystemConfig,
  options: SecurityScanOptions,
): string {
  const policy = options.policy ?? config.security.defaultPolicy;
  const sections = [`Security policy: ${policy}`];

  switch (policy) {
    case "light":
      sections.push(semgrepSection(config, options.workspacePath));
      break;
    case "normal":
      sections.push(
        semgrepSection(config, options.workspacePath),
        reviewNote(),
      );
      break;
    case "deep":
      sections.push(
        semgrepSection(config, options.workspacePath),
        reviewNote(),
        ...deepSections(config, options.workspacePath),
      );
      break;
    default: {
      const _exhaustive: never = policy;
      return _exhaustive;
    }
  }

  return truncate(sections.join("\n\n"));
}
