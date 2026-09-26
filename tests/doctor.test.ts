import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/core/config.js";
import { runDoctor } from "../src/doctor.js";

describe("runDoctor", () => {
  it(
    "returns remediation pointing at install.ps1",
    () => {
      const result = runDoctor(loadConfig());
      expect(result.checks.length).toBeGreaterThan(0);
      expect(result.remediation.toLowerCase()).toContain("install.ps1");
      expect(result.summary).toMatch(/OK|WARN/);
    },
    20_000,
  );

  it(
    "includes acs_cli check",
    () => {
      const result = runDoctor(loadConfig());
      expect(result.checks.some((c) => c.name === "acs_cli")).toBe(true);
    },
    20_000,
  );
});
