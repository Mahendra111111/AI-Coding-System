import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolveGitRoot } from "../project/identity.js";

export interface GitSummary {
  available: boolean;
  gitRoot: string | null;
  branch: string | null;
  commit: string | null;
  remote: string | null;
  dirtyFiles: string[];
  stagedFiles: string[];
  recentCommits: string[];
  error?: string;
}

function runGit(cwd: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  }).trim();
}

export function getGitSummary(workspacePath: string): GitSummary {
  if (!existsSync(workspacePath)) {
    return {
      available: false,
      gitRoot: null,
      branch: null,
      commit: null,
      remote: null,
      dirtyFiles: [],
      stagedFiles: [],
      recentCommits: [],
      error: `Path does not exist: ${workspacePath}`,
    };
  }

  const gitRoot = resolveGitRoot(workspacePath);
  if (!gitRoot) {
    return {
      available: false,
      gitRoot: null,
      branch: null,
      commit: null,
      remote: null,
      dirtyFiles: [],
      stagedFiles: [],
      recentCommits: [],
      error: "Not a git repository",
    };
  }

  try {
    const branch = runGit(gitRoot, ["rev-parse", "--abbrev-ref", "HEAD"]);
    const commit = runGit(gitRoot, ["rev-parse", "--short", "HEAD"]);
    let remote: string | null = null;
    try {
      remote = runGit(gitRoot, ["remote", "get-url", "origin"]);
    } catch {
      remote = null;
    }

    const status = runGit(gitRoot, ["status", "--porcelain"]);
    const dirtyFiles: string[] = [];
    const stagedFiles: string[] = [];
    for (const line of status.split("\n").filter(Boolean)) {
      const code = line.slice(0, 2);
      const file = line.slice(3);
      if (code[0] !== " " && code[0] !== "?") stagedFiles.push(file);
      if (code[1] !== " " || code.includes("?")) dirtyFiles.push(file);
      if (code === "??") dirtyFiles.push(file);
    }

    let recentCommits: string[] = [];
    try {
      const log = runGit(gitRoot, ["log", "-5", "--oneline"]);
      recentCommits = log.split("\n").filter(Boolean);
    } catch {
      recentCommits = [];
    }

    return {
      available: true,
      gitRoot,
      branch,
      commit,
      remote,
      dirtyFiles: [...new Set(dirtyFiles)],
      stagedFiles: [...new Set(stagedFiles)],
      recentCommits,
    };
  } catch (err) {
    return {
      available: false,
      gitRoot,
      branch: null,
      commit: null,
      remote: null,
      dirtyFiles: [],
      stagedFiles: [],
      recentCommits: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export function formatGitSummary(summary: GitSummary): string {
  if (!summary.available) {
    return `Git: unavailable (${summary.error ?? "unknown"})`;
  }
  const lines = [
    `Branch: ${summary.branch}`,
    `Commit: ${summary.commit}`,
    `Remote: ${summary.remote ?? "(none)"}`,
    `Dirty files (${summary.dirtyFiles.length}): ${
      summary.dirtyFiles.slice(0, 20).join(", ") || "(none)"
    }`,
    `Staged files (${summary.stagedFiles.length}): ${
      summary.stagedFiles.slice(0, 20).join(", ") || "(none)"
    }`,
    "Recent commits:",
    ...(summary.recentCommits.length
      ? summary.recentCommits.map((c) => `  - ${c}`)
      : ["  - (none)"]),
  ];
  return lines.join("\n");
}
