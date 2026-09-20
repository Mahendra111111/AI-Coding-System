import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { atomicWriteFile, atomicWriteJson } from "../core/atomicWrite.js";
import type { SystemConfig } from "../core/config.js";
import {
  architecturePath,
  constraintsPath,
  contextDir,
  decisionsPath,
  handoffPath,
  projectDir,
  projectJsonPath,
  projectStatePath,
  projectsDir,
  registryPath,
  templatesDir,
} from "../core/paths.js";
import { computeIdentity } from "./identity.js";

export interface ProjectMeta {
  projectId: string;
  projectName: string;
  workspacePath: string;
  gitRoot: string | null;
  gitRemote: string | null;
  currentBranch: string | null;
  identitySource: "gitRemote" | "workspacePath";
  canonicalIdentity: string;
  createdAt: string;
  updatedAt: string;
  lastEditor: string | null;
  lastSessionId: string | null;
}

export interface RegistryFile {
  version: 1;
  projects: Record<
    string,
    {
      projectId: string;
      projectName: string;
      workspacePath: string;
      gitRemote: string | null;
      updatedAt: string;
    }
  >;
}

function nowIso(): string {
  return new Date().toISOString();
}

function readTemplate(config: SystemConfig, name: string): string {
  return readFileSync(join(templatesDir(config), name), "utf8");
}

function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
}

function writeIfMissing(path: string, contents: string): void {
  if (!existsSync(path)) {
    atomicWriteFile(path, contents);
  }
}

export function loadRegistry(config: SystemConfig): RegistryFile {
  const path = registryPath(config);
  if (!existsSync(path)) {
    return { version: 1, projects: {} };
  }
  return JSON.parse(readFileSync(path, "utf8")) as RegistryFile;
}

export function saveRegistry(config: SystemConfig, registry: RegistryFile): void {
  atomicWriteJson(registryPath(config), registry);
}

export function loadProjectMeta(
  config: SystemConfig,
  projectId: string,
): ProjectMeta | null {
  const path = projectJsonPath(config, projectId);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as ProjectMeta;
}

export function findProjectByWorkspace(
  config: SystemConfig,
  workspacePath: string,
): ProjectMeta | null {
  const identity = computeIdentity(workspacePath, config.identity.hashLength);
  const byId = loadProjectMeta(config, identity.projectId);
  if (byId) return byId;

  // Fallback: scan registry for matching remote or path (move detection)
  const registry = loadRegistry(config);
  for (const entry of Object.values(registry.projects)) {
    if (
      identity.gitRemote &&
      entry.gitRemote &&
      entry.gitRemote === identity.gitRemote
    ) {
      return loadProjectMeta(config, entry.projectId);
    }
    if (
      entry.workspacePath.replace(/\\/g, "/").toLowerCase() ===
      identity.workspacePath.replace(/\\/g, "/").toLowerCase()
    ) {
      return loadProjectMeta(config, entry.projectId);
    }
  }
  return null;
}

function createBrainDirs(config: SystemConfig, projectId: string): void {
  const root = projectDir(config, projectId);
  mkdirSync(join(root, "context"), { recursive: true });
  mkdirSync(join(root, "graphify"), { recursive: true });
  mkdirSync(join(root, "memory"), { recursive: true });
  mkdirSync(join(root, "security"), { recursive: true });
  mkdirSync(join(root, "reviews"), { recursive: true });
  mkdirSync(join(root, "logs"), { recursive: true });
  mkdirSync(join(root, "temp"), { recursive: true });
  mkdirSync(join(root, "cache"), { recursive: true });
  mkdirSync(projectsDir(config), { recursive: true });
  mkdirSync(join(config.systemRoot, "state"), { recursive: true });
}

function seedMarkdown(
  config: SystemConfig,
  meta: ProjectMeta,
): void {
  const vars = {
    projectName: meta.projectName,
    projectId: meta.projectId,
    workspacePath: meta.workspacePath,
    gitRemote: meta.gitRemote ?? "(none)",
    currentBranch: meta.currentBranch ?? "(none)",
    updatedAt: meta.updatedAt,
    lastEditor: meta.lastEditor ?? "(unknown)",
  };

  writeIfMissing(
    projectStatePath(config, meta.projectId),
    fillTemplate(readTemplate(config, "PROJECT_STATE.md"), vars),
  );
  writeIfMissing(
    handoffPath(config, meta.projectId),
    fillTemplate(readTemplate(config, "HANDOFF.md"), vars),
  );
  writeIfMissing(
    decisionsPath(config, meta.projectId),
    readTemplate(config, "DECISIONS.md"),
  );
  writeIfMissing(
    constraintsPath(config, meta.projectId),
    readTemplate(config, "CONSTRAINTS.md"),
  );
  writeIfMissing(
    architecturePath(config, meta.projectId),
    readTemplate(config, "ARCHITECTURE.md"),
  );
}

export interface RegisterOptions {
  workspacePath: string;
  editor?: string;
  sessionId?: string;
}

export interface RegisterResult {
  created: boolean;
  meta: ProjectMeta;
  brainPath: string;
  contextPath: string;
}

/**
 * Idempotent project registration.
 * Same git remote => same projectId even if folder moved.
 */
export function registerProject(
  config: SystemConfig,
  options: RegisterOptions,
): RegisterResult {
  const identity = computeIdentity(
    options.workspacePath,
    config.identity.hashLength,
  );

  const existing = loadProjectMeta(config, identity.projectId);
  const timestamp = nowIso();
  let created = false;
  let meta: ProjectMeta;

  if (existing) {
    meta = {
      ...existing,
      projectName: identity.projectName || existing.projectName,
      workspacePath: identity.workspacePath,
      gitRoot: identity.gitRoot,
      gitRemote: identity.gitRemote,
      currentBranch: identity.currentBranch,
      identitySource: identity.identitySource,
      canonicalIdentity: identity.canonicalIdentity,
      updatedAt: timestamp,
      lastEditor: options.editor ?? existing.lastEditor,
      lastSessionId: options.sessionId ?? existing.lastSessionId,
    };
  } else {
    created = true;
    meta = {
      projectId: identity.projectId,
      projectName: identity.projectName,
      workspacePath: identity.workspacePath,
      gitRoot: identity.gitRoot,
      gitRemote: identity.gitRemote,
      currentBranch: identity.currentBranch,
      identitySource: identity.identitySource,
      canonicalIdentity: identity.canonicalIdentity,
      createdAt: timestamp,
      updatedAt: timestamp,
      lastEditor: options.editor ?? null,
      lastSessionId: options.sessionId ?? null,
    };
  }

  createBrainDirs(config, meta.projectId);
  atomicWriteJson(projectJsonPath(config, meta.projectId), meta);
  seedMarkdown(config, meta);

  const registry = loadRegistry(config);
  registry.projects[meta.projectId] = {
    projectId: meta.projectId,
    projectName: meta.projectName,
    workspacePath: meta.workspacePath,
    gitRemote: meta.gitRemote,
    updatedAt: meta.updatedAt,
  };
  saveRegistry(config, registry);

  return {
    created,
    meta,
    brainPath: projectDir(config, meta.projectId),
    contextPath: contextDir(config, meta.projectId),
  };
}

export function listProjects(config: SystemConfig): ProjectMeta[] {
  const registry = loadRegistry(config);
  const result: ProjectMeta[] = [];
  for (const id of Object.keys(registry.projects)) {
    const meta = loadProjectMeta(config, id);
    if (meta) result.push(meta);
  }
  return result.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function resolveProjectId(
  config: SystemConfig,
  args: { projectId?: string; workspacePath?: string },
): string {
  if (args.projectId) return args.projectId;
  if (args.workspacePath) {
    const found = findProjectByWorkspace(config, args.workspacePath);
    if (found) return found.projectId;
    return registerProject(config, { workspacePath: args.workspacePath }).meta
      .projectId;
  }
  throw new Error("Provide projectId or workspacePath");
}
