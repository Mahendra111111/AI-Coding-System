import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

export function isGraphifyAvailable(): boolean {
  const result = spawnSync("graphify", ["--help"], {
    encoding: "utf8",
    windowsHide: true,
    timeout: 5_000,
  });
  if (result.status === 0) return true;
  // Windows: try via cmd where without concatenating untrusted args into shell
  const where = spawnSync("where.exe", ["graphify"], {
    encoding: "utf8",
    windowsHide: true,
    timeout: 5_000,
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
    return "Graphify is not installed. Re-run: powershell -ExecutionPolicy Bypass -File <ACS_ROOT>\\install.ps1";
  }
  return runGraphify(["query", question], workspacePath);
}

export function graphExplain(workspacePath: string, symbol: string): string {
  if (!isGraphifyAvailable()) {
    return "Graphify is not installed. Re-run: powershell -ExecutionPolicy Bypass -File <ACS_ROOT>\\install.ps1";
  }
  return runGraphify(["explain", symbol], workspacePath);
}

export function graphExtract(
  workspacePath: string,
  preferCodeOnly = true,
): string {
  if (!isGraphifyAvailable()) {
    return "Graphify is not installed. Re-run: powershell -ExecutionPolicy Bypass -File <ACS_ROOT>\\install.ps1";
  }
  const args = ["extract", "."];
  if (preferCodeOnly) args.push("--code-only");
  return runGraphify(args, workspacePath);
}

export function graphOutputExists(workspacePath: string): boolean {
  return existsSync(join(workspacePath, "graphify-out", "graph.json"));
}

/**
 * Ensure Graphify has indexed this workspace (canonical store: graphify-out/graph.json).
 * When missing, runs extract before callers query/explain.
 */
export function ensureGraphIndexed(
  workspacePath: string,
  preferCodeOnly = true,
): { ranExtract: boolean; detail: string } {
  if (!isGraphifyAvailable()) {
    return {
      ranExtract: false,
      detail:
        "Graphify is not installed. Re-run: powershell -ExecutionPolicy Bypass -File <ACS_ROOT>\\install.ps1",
    };
  }
  if (graphOutputExists(workspacePath)) {
    return {
      ranExtract: false,
      detail: "Graphify index present (graphify-out/graph.json)",
    };
  }
  try {
    const out = graphExtract(workspacePath, preferCodeOnly);
    const preview = out.length > 240 ? `${out.slice(0, 240).trimEnd()}…` : out;
    return {
      ranExtract: true,
      detail: preview
        ? `Indexed missing graphify-out/graph.json: ${preview}`
        : "Indexed missing graphify-out/graph.json",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ranExtract: false,
      detail: `Graphify auto-index failed: ${message}`,
    };
  }
}
