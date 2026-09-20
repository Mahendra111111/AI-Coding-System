import { describe, expect, it } from "vitest";
import { isGraphifyAvailable } from "../src/graph/graphify.js";
import { graphifyStatus } from "../src/graph/status.js";

describe("graphify optional integration", () => {
  it("reports availability without throwing", () => {
    const available = isGraphifyAvailable();
    expect(typeof available).toBe("boolean");
    const status = graphifyStatus();
    expect(status.available).toBe(available);
    expect(status.hint.length).toBeGreaterThan(0);
  });
});
