import { describe, expect, it } from "vitest";
import type { SystemConfig } from "../src/core/config.js";
import { loadConfig } from "../src/core/config.js";
import {
  getAllProviderStatuses,
  type ProviderStatusRow,
} from "../src/providers/status.js";

describe("provider status", () => {
  it("reports every registered provider", () => {
    const statuses = getAllProviderStatuses(loadConfig());

    expect(statuses.length).toBeGreaterThanOrEqual(14);
    expect(
      statuses.every(
        (status: ProviderStatusRow) => status.id && status.role,
      ),
    ).toBe(true);
  });

  it("surfaces compression overlap", () => {
    const config: SystemConfig = {
      ...loadConfig(),
      contextMode: { enabled: true },
      caveman: { enabled: true },
    };
    const statuses = getAllProviderStatuses(config);
    const compressionStatuses = statuses.filter(
      (status: ProviderStatusRow) =>
        status.id === "context-mode" || status.id === "caveman",
    );

    expect(compressionStatuses).toHaveLength(2);
    expect(
      compressionStatuses.some((status: ProviderStatusRow) =>
        status.detail.toLowerCase().includes("overlap"),
      ),
    ).toBe(true);
  });
});
