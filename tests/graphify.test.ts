import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ensureGraphIndexed,
  graphOutputExists,
  isGraphifyAvailable,
} from "../src/graph/graphify.js";
import { graphifyStatus } from "../src/graph/status.js";

describe("graphify optional integration", () => {
  it(
    "reports availability without throwing",
    () => {
      const available = isGraphifyAvailable();
      expect(typeof available).toBe("boolean");
      const status = graphifyStatus();
      expect(status.available).toBe(available);
      expect(status.hint.length).toBeGreaterThan(0);
    },
    15_000,
  );
});

describe("ensureGraphIndexed", () => {
  it("no-ops when graphify-out/graph.json already exists", () => {
    const dir = mkdtempSync(join(tmpdir(), "acs-graphify-"));
    mkdirSync(join(dir, "graphify-out"));
    writeFileSync(join(dir, "graphify-out", "graph.json"), "{}");
    expect(graphOutputExists(dir)).toBe(true);

    const result = ensureGraphIndexed(dir);
    expect(result.ranExtract).toBe(false);
    expect(result.detail.toLowerCase()).toContain("present");
  });

  it("reports install remediation when CLI missing and graph absent", () => {
    if (isGraphifyAvailable()) {
      return;
    }
    const dir = mkdtempSync(join(tmpdir(), "acs-graphify-empty-"));
    expect(graphOutputExists(dir)).toBe(false);
    const result = ensureGraphIndexed(dir);
    expect(result.ranExtract).toBe(false);
    expect(result.detail.toLowerCase()).toMatch(/not installed|install\.ps1/);
  });
});
