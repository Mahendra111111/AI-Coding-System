import {
  cpSync,
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  canonicalizePath,
  hashIdentity,
  normalizeGitRemote,
  computeIdentity,
} from "../src/project/identity.js";
import type { SystemConfig } from "../src/core/config.js";
import {
  listProjects,
  registerProject,
} from "../src/project/register.js";
import { buildProjectContext } from "../src/context/buildContext.js";
import { updateHandoff, readHandoff } from "../src/project/state.js";

const temps: string[] = [];

function tempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  temps.push(dir);
  return dir;
}

afterEach(() => {
  while (temps.length) {
    const dir = temps.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

function makeSystem(root: string): SystemConfig {
  mkdirSync(join(root, "config"), { recursive: true });
  mkdirSync(join(root, "templates"), { recursive: true });
  mkdirSync(join(root, "state"), { recursive: true });
  mkdirSync(join(root, "projects"), { recursive: true });
  cpSync(join(process.cwd(), "templates"), join(root, "templates"), {
    recursive: true,
  });
  writeFileSync(
    join(root, "config", "system.json"),
    JSON.stringify(
      {
        systemRoot: root,
        projectRoots: ["D:\\"],
        identity: { hashLength: 20 },
        graphify: { enabled: true, preferCodeOnly: true },
        memory: { enabled: true, provider: "claude-mem" },
        ponytail: { enabled: true },
        caveman: { enabled: false },
        contextMode: { enabled: true },
        review: { openCodeReview: { enabled: true } },
        security: {
          semgrep: { enabled: true },
          codeql: { enabled: false },
          bearer: { enabled: false },
          defaultPolicy: "light",
        },
        validation: { maxBuildAttempts: 3 },
        telemetry: { enabled: false },
      },
      null,
      2,
    ),
  );
  return {
    systemRoot: root,
    projectRoots: ["D:\\"],
    identity: { hashLength: 20 },
    graphify: { enabled: true, preferCodeOnly: true },
    memory: { enabled: true, provider: "claude-mem" },
    ponytail: { enabled: true },
    caveman: { enabled: false },
    contextMode: { enabled: true },
    review: { openCodeReview: { enabled: true } },
    security: {
      semgrep: { enabled: true },
      codeql: { enabled: false },
      bearer: { enabled: false },
      defaultPolicy: "light",
    },
    validation: { maxBuildAttempts: 3 },
    telemetry: { enabled: false },
  };
}

describe("identity", () => {
  it("normalizes https and ssh remotes to the same form", () => {
    const a = normalizeGitRemote("https://github.com/Acme/App.git");
    const b = normalizeGitRemote("git@github.com:Acme/App.git");
    expect(a).toBe("github.com/Acme/App");
    expect(b).toBe("github.com/Acme/App");
    expect(hashIdentity(`remote:${a}`)).toBe(hashIdentity(`remote:${b}`));
  });

  it("hashes are stable and 20 hex chars by default", () => {
    const id = hashIdentity("remote:github.com/acme/app");
    expect(id).toMatch(/^[a-f0-9]{20}$/);
    expect(hashIdentity("remote:github.com/acme/app")).toBe(id);
  });

  it("uses workspace path when no git remote", () => {
    const ws = tempDir("acs-ws-");
    writeFileSync(join(ws, "readme.txt"), "hi");
    const identity = computeIdentity(ws);
    expect(identity.identitySource).toBe("workspacePath");
    expect(identity.projectId).toHaveLength(20);
    expect(identity.workspacePath).toBe(canonicalizePath(ws));
  });
});

describe("register + context", () => {
  it("registers idempotently and builds context", () => {
    const systemRoot = tempDir("acs-sys-");
    const config = makeSystem(systemRoot);
    const ws = tempDir("acs-proj-");
    writeFileSync(join(ws, "package.json"), '{"name":"demo"}');

    const first = registerProject(config, {
      workspacePath: ws,
      editor: "cursor",
    });
    expect(first.created).toBe(true);

    const second = registerProject(config, {
      workspacePath: ws,
      editor: "antigravity",
    });
    expect(second.created).toBe(false);
    expect(second.meta.projectId).toBe(first.meta.projectId);
    expect(second.meta.lastEditor).toBe("antigravity");

    updateHandoff(config, first.meta.projectId, {
      currentTask: "Add login",
      completed: ["Scaffolded form"],
      remaining: "Wire API",
      editor: "cursor",
    });

    const handoff = readHandoff(config, first.meta.projectId);
    expect(handoff).toContain("Add login");
    expect(handoff).toContain("Wire API");

    const ctx = buildProjectContext(config, {
      projectId: first.meta.projectId,
      includeGit: false,
    });
    expect(ctx.context).toContain("[PROJECT]");
    expect(ctx.context).toContain(first.meta.projectId);
    expect(ctx.context).toContain("Add login");

    const memorySentinel = "CLAUDE_MEM_FULL_DUMP_SENTINEL";
    const owaspSentinel = "OWASP_FULL_GUIDE_SENTINEL";
    const memoryDir = join(
      systemRoot,
      "projects",
      first.meta.projectId,
      "memory",
    );
    const owaspDir = join(systemRoot, "providers", "refs", "owasp-top10");
    mkdirSync(memoryDir, { recursive: true });
    mkdirSync(owaspDir, { recursive: true });
    writeFileSync(join(memoryDir, "full-dump.md"), memorySentinel);
    writeFileSync(join(owaspDir, "full-guide.md"), owaspSentinel);

    const isolatedCtx = buildProjectContext(config, {
      projectId: first.meta.projectId,
      includeGit: false,
    });
    expect(isolatedCtx.context).not.toContain(memorySentinel);
    expect(isolatedCtx.context).not.toContain(owaspSentinel);

    const listed = listProjects(config);
    expect(listed.some((p) => p.projectId === first.meta.projectId)).toBe(true);
  });

  it("same path identity is stable across register calls", () => {
    const systemRoot = tempDir("acs-sys2-");
    const config = makeSystem(systemRoot);
    const ws = tempDir("acs-proj2-");
    mkdirSync(ws, { recursive: true });
    const a = registerProject(config, { workspacePath: ws });
    const b = registerProject(config, { workspacePath: ws });
    expect(a.meta.projectId).toBe(b.meta.projectId);
  });
});
