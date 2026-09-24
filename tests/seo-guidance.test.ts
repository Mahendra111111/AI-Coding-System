import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { SystemConfig } from "../src/core/config.js";
import { getSeoGuidance, probeNextSeo } from "../src/providers/nextSeo.js";

function config(enabled = true): SystemConfig {
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
      baseUrl: "http://127.0.0.1:8000",
      confidenceThreshold: 0.75,
      autoStart: false,
      model: "von-1.1",
    },
    reticle: { enabled: true },
    nextSeo: { enabled },
    security: {
      semgrep: { enabled: true },
      codeql: { enabled: false },
      defaultPolicy: "light",
    },
    validation: { maxBuildAttempts: 3 },
    telemetry: { enabled: false },
  };
}

describe("next-seo guidance", () => {
  it("detects next-seo in a workspace package.json", () => {
    const dir = mkdtempSync(join(tmpdir(), "acs-seo-"));
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ dependencies: { "next-seo": "^6.0.0" } }),
    );
    const probe = probeNextSeo(dir);
    expect(probe.available).toBe(true);
    expect(probe.detail).toMatch(/next-seo \^6\.0\.0/);
  });

  it("embeds keywords and page type into guidance", () => {
    const text = getSeoGuidance(config(), {
      keywords: "mutual funds, SIP, India investing",
      pageType: "article",
      workspacePath: "D:\\missing-app",
    });
    expect(text).toMatch(/mutual funds/);
    expect(text).toMatch(/SIP/);
    expect(text).toMatch(/ArticleJsonLd/);
    expect(text).toMatch(/npm install next-seo/);
    expect(text).toMatch(/same change/i);
  });

  it("respects nextSeo.enabled=false", () => {
    expect(getSeoGuidance(config(false))).toMatch(/disabled/i);
  });
});
