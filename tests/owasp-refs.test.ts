import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import type { SystemConfig } from "../src/core/config.js";
import { securityRefs } from "../src/providers/owasp.js";

function base(partial: Partial<SystemConfig> = {}): SystemConfig {
  return {
    systemRoot: "C:\\AI-Coding-System",
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
    ...partial,
  };
}

function seedOwaspRefs(root: string): void {
  const scpDir = join(root, "providers", "refs", "owasp-scp");
  const top10Dir = join(root, "providers", "refs", "owasp-top10");
  mkdirSync(join(scpDir, "en"), { recursive: true });
  mkdirSync(top10Dir, { recursive: true });

  writeFileSync(
    join(scpDir, "en", "input-validation.md"),
    `# Input Validation

Validate all input at trust boundaries. Use allowlists, not denylists.
Reject unexpected types early. Sanitize only when necessary.`,
  );

  writeFileSync(
    join(top10Dir, "A03-injection.md"),
    `# Injection

Never concatenate user input into SQL queries.
Use parameterized queries and prepared statements.`,
  );

  writeFileSync(
    join(top10Dir, "A01-access-control.md"),
    `# Broken Access Control

Enforce authorization on every request. Deny by default.`,
  );
}

describe("securityRefs", () => {
  it("returns install hint when OWASP refs are missing", () => {
    const root = mkdtempSync(join(tmpdir(), "acs-owasp-missing-"));
    const result = securityRefs(base({ systemRoot: root }), "general");

    expect(result.toLowerCase()).toContain("install");
    expect(result).toMatch(/owasp-scp|secure-coding-practices/i);
    expect(result).toMatch(/owasp-top10|Top10/i);
  });

  it("returns topic excerpts from installed refs", () => {
    const root = mkdtempSync(join(tmpdir(), "acs-owasp-present-"));
    seedOwaspRefs(root);

    const result = securityRefs(base({ systemRoot: root }), "input-validation");

    expect(result.toLowerCase()).toContain("input validation");
    expect(result.toLowerCase()).toContain("allowlist");
    expect(result).toContain("input-validation.md");
  });

  it("matches injection topic across ref trees", () => {
    const root = mkdtempSync(join(tmpdir(), "acs-owasp-injection-"));
    seedOwaspRefs(root);

    const result = securityRefs(base({ systemRoot: root }), "injection");

    expect(result.toLowerCase()).toContain("injection");
    expect(result.toLowerCase()).toMatch(/sql|parameterized/);
  });

  it("truncates output to maxChars", () => {
    const root = mkdtempSync(join(tmpdir(), "acs-owasp-truncate-"));
    seedOwaspRefs(root);
    writeFileSync(
      join(root, "providers", "refs", "owasp-scp", "en", "input-validation.md"),
      "Validate everything. ".repeat(500),
    );

    const result = securityRefs(
      base({ systemRoot: root }),
      "input-validation",
      200,
    );

    expect(result.length).toBeLessThanOrEqual(200);
    expect(result.endsWith("…")).toBe(true);
  });

  it("rejects unknown topics", () => {
    const result = securityRefs(base(), "not-a-topic");

    expect(result.toLowerCase()).toContain("unknown topic");
    expect(result).toContain("input-validation");
    expect(result).toContain("access-control");
  });
});
