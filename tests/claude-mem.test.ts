import { afterEach, describe, expect, it, vi } from "vitest";
import type { SystemConfig } from "../src/core/config.js";
import { memoryGet, memorySearch } from "../src/providers/claudeMem.js";

function config(enabled = true): SystemConfig {
  return {
    systemRoot: "C:\\AI-Coding-System",
    projectRoots: ["D:\\"],
    identity: { hashLength: 20 },
    graphify: { enabled: true, preferCodeOnly: true },
    memory: { enabled, provider: "claude-mem" },
    ponytail: { enabled: true },
    caveman: { enabled: false },
    contextMode: { enabled: true },
    review: { openCodeReview: { enabled: true } },
    security: {
      semgrep: { enabled: true },
      codeql: { enabled: false },
      defaultPolicy: "light",
    },
    validation: { maxBuildAttempts: 3 },
    von: {
      enabled: true,
      baseUrl: "http://127.0.0.1:8000",
      confidenceThreshold: 0.75,
      autoStart: false,
      model: "von-1.1",
    },
    reticle: { enabled: true },
    nextSeo: { enabled: true },
    telemetry: { enabled: false },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.CLAUDE_MEM_WORKER_URL;
});

describe("Claude-Mem selective retrieval", () => {
  it("searches the worker and returns its JSON response", async () => {
    process.env.CLAUDE_MEM_WORKER_URL = "http://127.0.0.1:39999/";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ results: [{ id: 42, title: "Decision" }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const result = await memorySearch(config(), "auth migration", 3);

    expect(JSON.parse(result)).toEqual({
      results: [{ id: 42, title: "Decision" }],
    });
    const url = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(`${url.origin}${url.pathname}`).toBe(
      "http://127.0.0.1:39999/api/search",
    );
    expect(url.searchParams.get("query")).toBe("auth migration");
    expect(url.searchParams.get("type")).toBe("observations");
    expect(url.searchParams.get("format")).toBe("index");
    expect(url.searchParams.get("limit")).toBe("3");
  });

  it("gets only the requested observation ids", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([{ id: 7 }, { id: 11 }]), { status: 200 }),
    );

    const result = await memoryGet(config(), [7, 11]);

    expect(JSON.parse(result)).toEqual([{ id: 7 }, { id: 11 }]);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      "http://127.0.0.1:37777/api/observations/batch",
    );
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ ids: [7, 11] });
  });

  it("does not contact the worker when memory is disabled", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    await expect(memorySearch(config(false), "anything")).resolves.toMatch(
      /disabled/i,
    );
    await expect(memoryGet(config(false), [1])).resolves.toMatch(/disabled/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns an actionable install hint when the worker is unavailable", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new Error("connect ECONNREFUSED"),
    );

    const result = await memorySearch(config(), "anything");

    expect(result).toContain("npx claude-mem install --provider host");
    expect(result).toMatch(/CLAUDE_MEM_WORKER_URL/);
  });
});
