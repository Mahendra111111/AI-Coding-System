import { afterEach, describe, expect, it, vi } from "vitest";
import type { SystemConfig } from "../src/core/config.js";
import {
  FAMILY_CRITERIA,
  TOOL_CATALOG,
  toolsForFamily,
} from "../src/decision/catalog.js";
import {
  buildDecisionState,
  decideGate,
  decideTools,
} from "../src/decision/decideTools.js";

function config(overrides: Partial<SystemConfig["von"]> = {}): SystemConfig {
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
    von: {
      enabled: true,
      baseUrl: "http://127.0.0.1:18000",
      confidenceThreshold: 0.75,
      autoStart: false,
      model: "von-1.1",
      ...overrides,
    },
    reticle: { enabled: true },
    nextSeo: { enabled: true },
    security: {
      semgrep: { enabled: true },
      codeql: { enabled: false },
      defaultPolicy: "light",
    },
    validation: { maxBuildAttempts: 3 },
    telemetry: { enabled: false },
  };
}

function choiceAnswer(
  choiceId: string,
  confidence: number,
  probabilities?: Record<string, number>,
) {
  return {
    type: "choice" as const,
    choice: choiceId,
    confidence,
    probabilities: probabilities ?? { [choiceId]: confidence },
  };
}

function systemOneResponse(answers: Record<string, unknown>) {
  return {
    model: "von-1.1.0",
    answers,
    usage: { input_tokens: 10, output_tokens: 0 },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.VON_BASE_URL;
});

describe("decision catalog", () => {
  it("maps every catalog tool to a known family exactly once", () => {
    const ids = TOOL_CATALOG.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const entry of TOOL_CATALOG) {
      expect(FAMILY_CRITERIA[entry.family]).toBeTruthy();
      expect(toolsForFamily(entry.family).some((t) => t.id === entry.id)).toBe(
        true,
      );
    }
  });

  it("builds compact decision state", () => {
    expect(
      buildDecisionState({
        task: "run security scan",
        hints: "light policy",
        projectHint: "Next.js app",
      }),
    ).toBe(
      "Task: run security scan\nHints: light policy\nProject: Next.js app",
    );
  });
});

describe("decideTools / decideGate with mocked Von", () => {
  it("returns recommended tool and peer for verify_ui", async () => {
    process.env.VON_BASE_URL = "http://127.0.0.1:18000/";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      async (url, init) => {
        const href = String(url);
        if (href.endsWith("/") || (init?.method ?? "GET") === "GET") {
          if (!href.includes("/v1/systemone")) {
            return new Response("ok", { status: 200 });
          }
        }
        const body = JSON.parse(String(init?.body ?? "{}")) as {
          questions?: Record<string, { type: string }>;
        };
        const keys = Object.keys(body.questions ?? {});
        if (keys.includes("family")) {
          return new Response(
            JSON.stringify(
              systemOneResponse({
                family: choiceAnswer("verify_ui", 0.92),
              }),
            ),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        return new Response(
          JSON.stringify(
            systemOneResponse({
              tool: choiceAnswer("reticle_verify", 0.9),
            }),
          ),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      },
    );

    const result = await decideTools(config(), {
      task: "Prove the checkout button works in the running app",
    });

    expect(result.escalate).toBe(false);
    expect(result.family).toBe("verify_ui");
    expect(result.tool).toBe("reticle_verify");
    expect(result.peer).toEqual({
      mcp: "reticle",
      flow: "snapshot → act_sequence → act_and_wait|assert",
    });
    expect(fetchMock).toHaveBeenCalled();
    const systemOneCall = fetchMock.mock.calls.find((call) =>
      String(call[0]).includes("/v1/systemone"),
    );
    expect(String(systemOneCall?.[0])).toBe(
      "http://127.0.0.1:18000/v1/systemone",
    );
  });

  it("escalates when confidence is below threshold", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify(
          systemOneResponse({
            family: choiceAnswer("security", 0.4, {
              security: 0.4,
              context: 0.3,
            }),
          }),
        ),
        { status: 200 },
      ),
    );

    const result = await decideTools(config({ confidenceThreshold: 0.75 }), {
      task: "maybe scan?",
    });

    expect(result.family).toBe("security");
    expect(result.escalate).toBe(true);
    expect(result.next).toMatch(/Low confidence/i);
  });

  it("returns escalate error when Von is down", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONNREFUSED"));

    const result = await decideTools(config(), { task: "anything" });

    expect(result.escalate).toBe(true);
    expect(result.error).toMatch(/not listening|unavailable|auto-start/i);
    expect(result.tool).toBe("no_tool");
  });

  it("does not call Von when disabled", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const result = await decideTools(config({ enabled: false }), {
      task: "security",
    });
    expect(result.escalate).toBe(true);
    expect(result.error).toMatch(/disabled/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("decide_gate returns noul and escalate flag", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify(
            systemOneResponse({
              verdict: { type: "noul", noul: 0.91 },
            }),
        ),
        { status: 200 },
      ),
    );

    const result = await decideGate(config(), {
      state: "SQL injection in login form",
      question: "Should we run a security scan?",
    });

    expect(result.noul).toBe(0.91);
    expect(result.escalate).toBe(false);
  });
});
