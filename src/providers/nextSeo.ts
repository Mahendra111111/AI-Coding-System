import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { SystemConfig } from "../core/config.js";
import { skillsDir } from "../core/paths.js";

const NEXT_SEO_INSTALL = "npm install next-seo";
const NEXT_SEO_REPO = "https://github.com/garmeeh/next-seo";

export type SeoPageType =
  | "article"
  | "organization"
  | "product"
  | "faq"
  | "howto"
  | "website";

const PAGE_TYPE_HINT: Record<SeoPageType, string> = {
  article: "Use ArticleJsonLd + generateMetadata (type article).",
  organization: "Use OrganizationJsonLd on site/layout + brand metadata.",
  product: "Use ProductJsonLd + product metadata/OG.",
  faq: "Use FAQJsonLd; mirror Q&A in visible content.",
  howto: "Use HowToJsonLd for step tutorials.",
  website: "Site-wide generateMetadata + OrganizationJsonLd (and WebSite if needed).",
};

function parseKeywords(raw?: string): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[,|\n]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function readSkillFile(config: SystemConfig, name: string): string | null {
  const path = join(skillsDir(config), "next-seo", name);
  if (!existsSync(path)) return null;
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

export function probeNextSeo(
  workspacePath?: string,
): { available: boolean; detail: string } {
  if (!workspacePath) {
    return {
      available: false,
      detail: `Per-app dependency; install in the Next.js workspace: ${NEXT_SEO_INSTALL} (${NEXT_SEO_REPO})`,
    };
  }

  const pkgPath = join(workspacePath, "package.json");
  if (!existsSync(pkgPath)) {
    return {
      available: false,
      detail: `No package.json at ${workspacePath}; next-seo installs in Next.js apps only`,
    };
  }

  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const version =
      pkg.dependencies?.["next-seo"] ?? pkg.devDependencies?.["next-seo"];
    if (version) {
      return {
        available: true,
        detail: `next-seo ${version} present in ${workspacePath}`,
      };
    }
  } catch {
    // fall through
  }

  return {
    available: false,
    detail: `next-seo missing in ${workspacePath}; run: ${NEXT_SEO_INSTALL}`,
  };
}

export function getSeoGuidance(
  config: SystemConfig,
  args: {
    keywords?: string;
    workspacePath?: string;
    pageType?: SeoPageType;
  } = {},
): string {
  if (!config.nextSeo.enabled) {
    return "Next SEO guidance is disabled in config (nextSeo.enabled=false).";
  }

  const keywords = parseKeywords(args.keywords);
  const pageType: SeoPageType = args.pageType ?? "website";
  const probe = probeNextSeo(args.workspacePath);
  const skillDir = join(skillsDir(config), "next-seo");

  const lines = [
    "ACS SEO ENGINE — people-first, search-intent-driven SEO (not ranking guarantees).",
    `Authority: Google Search Central current guidance. Full spec: ${join(skillDir, "SEO-ENGINE.md")}`,
    `next-seo library: ${NEXT_SEO_REPO}`,
    `Status: ${probe.available ? "installed" : "missing"} — ${probe.detail}`,
    `Page type: ${pageType} — ${PAGE_TYPE_HINT[pageType]}`,
    "",
    "Never promise #1 rankings, guaranteed indexing, or guaranteed traffic.",
    "Final content must be human-reviewed; never fabricate experience, stats, or credentials.",
    "Ship generateMetadata + next-seo JSON-LD in the SAME change as content.",
    "Keyword density is diagnostic only — never optimize to a fixed %.",
    "TOPICAL COVERAGE > EXACT-MATCH REPETITION.",
    "",
  ];

  if (keywords.length > 0) {
    lines.push(
      "User keywords (primary first — use naturally; build a semantic map around them):",
    );
    for (const keyword of keywords) {
      lines.push(`- ${keyword}`);
    }
    lines.push("");
    lines.push(
      `Primary topic candidate: "${keywords[0]}"`,
      "Before writing: confirm audience + intent; draft unique outline; identify content gaps vs competitors (do not copy).",
      `Meta title preference: clear topic + brand (~580px practical width). Example: "${keywords[0]} | <Brand>"`,
      `Meta description: accurate intent match (~920px practical width); include topic once naturally.`,
      "",
    );
  } else {
    lines.push(
      "No keywords supplied. Ask once for: audience, primary intent, primary keyword, secondary keywords.",
      "",
    );
  }

  lines.push(
    "Install (in the app workspace, not ACS):",
    `  ${NEXT_SEO_INSTALL}`,
    "",
    "Same-change technical checklist:",
    "1. generateMetadata (title, description, keywords, openGraph / Twitter)",
    "2. next-seo JSON-LD only if the page genuinely qualifies",
    "3. One clear H1; logical H2/H3; descriptive URL",
    "4. Useful internal links; image alt (not keyword lists)",
    "5. Pre-publish audit (SEO-ENGINE §29)",
    "",
  );

  const skill = readSkillFile(config, "SKILL.md");
  const engine = readSkillFile(config, "SEO-ENGINE.md");

  if (skill) {
    lines.push("--- SKILL ---", "", skill, "");
  }
  if (engine) {
    lines.push("--- SEO ENGINE (full) ---", "", engine);
  }
  if (!skill && !engine) {
    lines.push(`Skill files missing under ${skillDir}. See docs/PROVIDERS.md.`);
  }

  return lines.join("\n");
}
