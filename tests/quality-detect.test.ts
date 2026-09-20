import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  detectQualityStack,
  runQualityCheck,
} from "../src/providers/quality.js";

function fixture(name: string, files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), `acs-quality-${name}-`));
  for (const [rel, content] of Object.entries(files)) {
    const target = join(root, rel);
    mkdirSync(join(target, ".."), { recursive: true });
    writeFileSync(target, content);
  }
  return root;
}

describe("detectQualityStack", () => {
  it("returns none when no quality tooling is configured", () => {
    const root = fixture("empty", {});
    const stack = detectQualityStack(root);

    expect(stack.formatter).toBe("none");
    expect(stack.linter).toBe("none");
    expect(stack.conflict).toBe(false);
    expect(stack.detail.toLowerCase()).toContain("no quality");
  });

  it("detects biome-only stack from biome.json", () => {
    const root = fixture("biome-only", {
      "biome.json": '{"linter":{"enabled":true}}',
    });
    const stack = detectQualityStack(root);

    expect(stack.formatter).toBe("biome");
    expect(stack.linter).toBe("biome");
    expect(stack.conflict).toBe(false);
    expect(stack.detail.toLowerCase()).toContain("biome");
  });

  it("detects prettier and eslint without conflict", () => {
    const root = fixture("prettier-eslint", {
      ".prettierrc": '{"singleQuote":true}',
      "eslint.config.js": "export default [];",
    });
    const stack = detectQualityStack(root);

    expect(stack.formatter).toBe("prettier");
    expect(stack.linter).toBe("eslint");
    expect(stack.conflict).toBe(false);
  });

  it("flags prettier and biome as conflicting", () => {
    const root = fixture("prettier-biome", {
      ".prettierrc.json": "{}",
      "biome.json": "{}",
    });
    const stack = detectQualityStack(root);

    expect(stack.conflict).toBe(true);
    expect(stack.detail.toLowerCase()).toMatch(/prettier.*biome|biome.*prettier/);
  });

  it("flags eslint and biome as conflicting", () => {
    const root = fixture("eslint-biome", {
      "eslint.config.mjs": "export default [];",
      "biome.json": "{}",
    });
    const stack = detectQualityStack(root);

    expect(stack.conflict).toBe(true);
    expect(stack.detail.toLowerCase()).toMatch(/eslint.*biome|biome.*eslint/);
  });

  it("detects tooling from package.json deps and scripts", () => {
    const root = fixture("package-json", {
      "package.json": JSON.stringify(
        {
          devDependencies: {
            prettier: "^3.0.0",
            eslint: "^9.0.0",
          },
          scripts: {
            format: "prettier --check .",
            lint: "eslint .",
          },
        },
        null,
        2,
      ),
    });
    const stack = detectQualityStack(root);

    expect(stack.formatter).toBe("prettier");
    expect(stack.linter).toBe("eslint");
    expect(stack.conflict).toBe(false);
  });

  it("detects biome from package.json dependency", () => {
    const root = fixture("biome-dep", {
      "package.json": JSON.stringify({
        devDependencies: {
          "@biomejs/biome": "^1.9.0",
        },
        scripts: {
          check: "biome check .",
        },
      }),
    });
    const stack = detectQualityStack(root);

    expect(stack.formatter).toBe("biome");
    expect(stack.linter).toBe("biome");
    expect(stack.conflict).toBe(false);
  });
});

describe("runQualityCheck", () => {
  it("reports conflict without running competing tools", () => {
    const root = fixture("run-conflict", {
      ".prettierrc": "{}",
      "biome.json": "{}",
    });
    const output = runQualityCheck(root);

    expect(output.toLowerCase()).toContain("conflict");
    expect(output.length).toBeLessThanOrEqual(4000);
  });

  it("reports when no tools are configured", () => {
    const root = fixture("run-empty", {});
    const output = runQualityCheck(root);

    expect(output.toLowerCase()).toMatch(/no quality|not configured/);
    expect(output.length).toBeLessThanOrEqual(4000);
  });
});
