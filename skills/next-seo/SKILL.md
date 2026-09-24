---
name: next-seo
description: >-
  When adding or changing Next.js website content/pages, install next-seo and
  wire SEO (metadata + JSON-LD) in the same change using the user's keywords —
  never ship pages as an SEO afterthought.
---

# Next SEO (target app dependency)

[next-seo](https://github.com/garmeeh/next-seo) lives in the **Next.js app**
(`npm install next-seo` there). ACS does not bundle it. Agents must apply SEO
**while creating content**, using keywords the user provides.

## Rule

If you add a page, section, blog post, product, FAQ, or marketing copy → also add:

1. Next.js App Router `generateMetadata` / `metadata` (title, description, openGraph, keywords)
2. Matching `next-seo` JSON-LD for the content type

Do **not** leave SEO for a follow-up PR unless the user explicitly says so.

## When to use

- Building or editing a Next.js site (App Router preferred)
- User supplies keywords / target queries / brand phrases
- ACS `decide_tools` recommends `seo` / `seo_guidance`

## Setup (once per app)

```bash
npm install next-seo
# or: pnpm add next-seo / yarn add next-seo
```

Pages Router: import from `next-seo/pages` (see upstream docs).

## Workflow (keywords → SEO + content)

1. Collect keywords from the user (primary + secondary). If missing, ask once.
2. Call ACS `seo_guidance` with `keywords`, `workspacePath`, and `pageType`.
3. Ensure `next-seo` is in the app `package.json`; install if missing.
4. Implement the page **and** SEO in one pass:
   - `generateMetadata`: title/description/keywords/OG using the keyword set
   - JSON-LD: pick the component that matches the page (see map below)
5. Align H1/H2 and body copy with keywords without stuffing.
6. Optional: Reticle-verify the live page after SEO + content land.

## Page type → next-seo component

| Page type | Prefer |
|-----------|--------|
| Blog / news / article | `ArticleJsonLd` |
| Company / brand home | `OrganizationJsonLd` (+ site `WebSite` metadata) |
| Product / service | `ProductJsonLd` |
| FAQ | `FAQJsonLd` |
| Tutorial / steps | `HowToJsonLd` |
| Generic marketing | `generateMetadata` + `OrganizationJsonLd` or `WebPage` patterns as needed |

Meta title/description: use Next.js [`generateMetadata`](https://nextjs.org/docs/app/api-reference/functions/generate-metadata). next-seo focuses on **JSON-LD** in App Router.

## Minimal App Router pattern

```tsx
import type { Metadata } from "next";
import { ArticleJsonLd } from "next-seo";

export function generateMetadata(): Metadata {
  return {
    title: "Primary Keyword | Brand",
    description: "One clear sentence with secondary keywords.",
    keywords: ["primary keyword", "secondary", "brand"],
    openGraph: {
      title: "Primary Keyword | Brand",
      description: "One clear sentence with secondary keywords.",
      type: "article",
    },
  };
}

export default function Page() {
  return (
    <>
      <ArticleJsonLd
        headline="Primary Keyword | Brand"
        datePublished="2026-01-01T08:00:00+00:00"
        author="Brand"
        description="One clear sentence with secondary keywords."
        image="https://example.com/og.jpg"
      />
      {/* page content */}
    </>
  );
}
```

## MCP tools

- ACS: `seo_guidance`, `decide_tools`, `list_acs_skills`
- Target app: `next-seo` package (not an ACS MCP server)

## Output checklist

- [ ] `next-seo` installed in the app
- [ ] Keywords reflected in title, description, and headings
- [ ] JSON-LD component matches page type
- [ ] OG fields set for share previews
- [ ] No SEO-only follow-up left for “later”
