import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { basename, resolve } from "node:path";

export interface IdentityResult {
  projectId: string;
  projectName: string;
  workspacePath: string;
  gitRoot: string | null;
  gitRemote: string | null;
  currentBranch: string | null;
  identitySource: "gitRemote" | "workspacePath";
  canonicalIdentity: string;
}

function runGit(cwd: string, args: string[]): string | null {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      windowsHide: true,
    }).trim();
  } catch {
    return null;
  }
}

export function normalizeGitRemote(remote: string): string {
  let value = remote.trim();
  if (value.endsWith(".git")) value = value.slice(0, -4);

  // git@host:org/repo -> host/org/repo
  const scp = /^git@([^:]+):(.+)$/i.exec(value);
  if (scp) {
    return `${scp[1].toLowerCase()}/${scp[2].replace(/^\/+/, "")}`.replace(/\\/g, "/");
  }

  // ssh://git@host/org/repo
  const ssh = /^ssh:\/\/(?:git@)?([^/]+)\/(.+)$/i.exec(value);
  if (ssh) {
    return `${ssh[1].toLowerCase()}/${ssh[2].replace(/^\/+/, "")}`.replace(/\\/g, "/");
  }

  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const path = url.pathname.replace(/^\/+/, "").replace(/\/+$/, "");
    return `${host}/${path}`;
  } catch {
    return value.replace(/\\/g, "/").toLowerCase();
  }
}

export function canonicalizePath(workspacePath: string): string {
  const resolved = resolve(workspacePath);
  // Windows: normalize drive letter casing
  if (/^[a-zA-Z]:/.test(resolved)) {
    return `${resolved[0]!.toUpperCase()}${resolved.slice(1)}`;
  }
  return resolved;
}

export function hashIdentity(canonical: string, length = 20): string {
  return createHash("sha256").update(canonical, "utf8").digest("hex").slice(0, length);
}

export function resolveGitRoot(workspacePath: string): string | null {
  const root = runGit(workspacePath, ["rev-parse", "--show-toplevel"]);
  return root ? canonicalizePath(root) : null;
}

export function resolveGitRemote(gitRoot: string): string | null {
  return runGit(gitRoot, ["remote", "get-url", "origin"]);
}

export function resolveCurrentBranch(gitRoot: string): string | null {
  return runGit(gitRoot, ["rev-parse", "--abbrev-ref", "HEAD"]);
}

export function computeIdentity(
  workspacePath: string,
  hashLength = 20,
): IdentityResult {
  if (!existsSync(workspacePath)) {
    throw new Error(`Workspace path does not exist: ${workspacePath}`);
  }

  const canonicalWorkspace = canonicalizePath(workspacePath);
  const gitRoot = resolveGitRoot(canonicalWorkspace);
  const rawRemote = gitRoot ? resolveGitRemote(gitRoot) : null;
  const currentBranch = gitRoot ? resolveCurrentBranch(gitRoot) : null;

  let identitySource: "gitRemote" | "workspacePath";
  let canonicalIdentity: string;
  let gitRemote: string | null = null;

  if (rawRemote) {
    gitRemote = normalizeGitRemote(rawRemote);
    canonicalIdentity = `remote:${gitRemote}`;
    identitySource = "gitRemote";
  } else {
    canonicalIdentity = `path:${canonicalWorkspace.replace(/\\/g, "/").toLowerCase()}`;
    identitySource = "workspacePath";
  }

  const projectId = hashIdentity(canonicalIdentity, hashLength);
  const projectName = basename(gitRoot ?? canonicalWorkspace);

  return {
    projectId,
    projectName,
    workspacePath: canonicalWorkspace,
    gitRoot,
    gitRemote,
    currentBranch,
    identitySource,
    canonicalIdentity,
  };
}
