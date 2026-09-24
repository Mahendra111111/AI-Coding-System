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
  const skillPath = join(skillsDir(config), "next-seo", "SKILL.md");

  const lines = [
    "SEO-first content workflow (next-seo in the target Next.js app).",
    `Upstream: ${NEXT_SEO_REPO}`,
    `Status: ${probe.available ? "installed" : "missing"} — ${probe.detail}`,
    `Page type: ${pageType} — ${PAGE_TYPE_HINT[pageType]}`,
    "",
    "Default rule: when adding website content, ship metadata + JSON-LD in the same change.",
    "",
  ];

  if (keywords.length > 0) {
    lines.push("Keywords to weave into title, description, headings, and JSON-LD:");
    for (const keyword of keywords) {
      lines.push(`- ${keyword}`);
    }
    lines.push("");
    lines.push(
      `Suggested title pattern: "${keywords[0]} | <Brand>"`,
      `Suggested description: one sentence including "${keywords.slice(0, 3).join(", ")}" without stuffing.`,
      "",
    );
  } else {
    lines.push(
      "No keywords supplied. Ask the user for primary + secondary keywords before writing page copy.",
      "",
    );
  }

  lines.push(
    "Install (in the app workspace, not ACS):",
    `  ${NEXT_SEO_INSTALL}`,
    "",
    "Same-change checklist:",
    "1. generateMetadata / metadata (title, description, keywords, openGraph)",
    "2. next-seo JSON-LD for the page type",
    "3. H1/H2 aligned with keywords",
    "4. Do not defer SEO to a later task",
    "",
  );

  if (existsSync(skillPath)) {
    try {
      lines.push(readFileSync(skillPath, "utf8"));
      return lines.join("\n");
    } catch {
      // fall through
    }
  }

  lines.push(`Skill file missing at ${skillPath}. See docs/PROVIDERS.md.`);
  return lines.join("\n");
}
