import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

export function isGraphifyAvailable(): boolean {
  const result = spawnSync("graphify", ["--help"], {
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.status === 0) return true;
  // Windows: try via cmd where without concatenating untrusted args into shell
  const where = spawnSync("where.exe", ["graphify"], {
    encoding: "utf8",
    windowsHide: true,
  });
  return where.status === 0;
}

function runGraphify(args: string[], cwd: string): string {
  try {
    return execFileSync("graphify", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      timeout: 120_000,
    }).trim();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`graphify failed: ${message}`);
  }
}

export function graphQuery(workspacePath: string, question: string): string {
  if (!isGraphifyAvailable()) {
    return "Graphify is not installed. Install with: uv tool install graphifyy";
  }
  return runGraphify(["query", question], workspacePath);
}

export function graphExplain(workspacePath: string, symbol: string): string {
  if (!isGraphifyAvailable()) {
    return "Graphify is not installed. Install with: uv tool install graphifyy";
  }
  return runGraphify(["explain", symbol], workspacePath);
}

export function graphExtract(
  workspacePath: string,
  preferCodeOnly = true,
): string {
  if (!isGraphifyAvailable()) {
    return "Graphify is not installed. Install with: uv tool install graphifyy";
  }
  const args = ["extract", "."];
  if (preferCodeOnly) args.push("--code-only");
  return runGraphify(args, workspacePath);
}

export function graphOutputExists(workspacePath: string): boolean {
  return existsSync(join(workspacePath, "graphify-out", "graph.json"));
}
