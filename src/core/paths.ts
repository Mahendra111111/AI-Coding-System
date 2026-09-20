import { join } from "node:path";
import type { SystemConfig } from "./config.js";

export function projectsDir(config: SystemConfig): string {
  return join(config.systemRoot, "projects");
}

export function projectDir(config: SystemConfig, projectId: string): string {
  return join(projectsDir(config), projectId);
}

export function templatesDir(config: SystemConfig): string {
  return join(config.systemRoot, "templates");
}

export function registryPath(config: SystemConfig): string {
  return join(config.systemRoot, "state", "registry.json");
}

export function projectJsonPath(config: SystemConfig, projectId: string): string {
  return join(projectDir(config, projectId), "project.json");
}

export function contextDir(config: SystemConfig, projectId: string): string {
  return join(projectDir(config, projectId), "context");
}

export function handoffPath(config: SystemConfig, projectId: string): string {
  return join(contextDir(config, projectId), "HANDOFF.md");
}

export function projectStatePath(config: SystemConfig, projectId: string): string {
  return join(contextDir(config, projectId), "PROJECT_STATE.md");
}

export function decisionsPath(config: SystemConfig, projectId: string): string {
  return join(contextDir(config, projectId), "DECISIONS.md");
}

export function constraintsPath(config: SystemConfig, projectId: string): string {
  return join(contextDir(config, projectId), "CONSTRAINTS.md");
}

export function architecturePath(config: SystemConfig, projectId: string): string {
  return join(contextDir(config, projectId), "ARCHITECTURE.md");
}
