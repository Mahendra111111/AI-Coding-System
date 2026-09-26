---
name: next-seo
description: >-
  ACS SEO Engine for Next.js: people-first, intent-driven content + next-seo
  technical SEO. Call seo_guidance; follow skills/next-seo/SEO-ENGINE.md. Ship
  metadata + JSON-LD with content — never as an afterthought. No ranking promises.
---

# Next SEO + ACS SEO Engine

You are operating under the **ACS SEO Engine**
([SEO-ENGINE.md](./SEO-ENGINE.md)).

[next-seo](https://github.com/garmeeh/next-seo) installs in the **Next.js app**
(`npm install next-seo`). ACS does not bundle it.

## Non-negotiables

1. Follow [SEO-ENGINE.md](./SEO-ENGINE.md) for every page/landing/blog/product/service/category piece of content.
2. People-first + search intent first — not keyword density games.
3. Final copy must be human-reviewed; never fabricate experience, stats, or credentials.
4. Ship `generateMetadata` + next-seo JSON-LD **in the same change** as content.
5. Never promise #1 rankings, guaranteed traffic, or guaranteed indexing.

## When to use

- Any Next.js site content or page work
- User supplies keywords / audience / intent (ask once if missing)
- ACS `decide_tools` → `seo` / `seo_guidance`

## Setup (once per app)

```bash
npm install next-seo
```

Pages Router: import from `next-seo/pages`.

## Workflow

1. Identify audience, intent, primary + secondary keywords, semantic map (SEO-ENGINE §4–7, §27).
2. Call ACS `seo_guidance` with `keywords`, `workspacePath`, `pageType`.
3. Ensure `next-seo` is installed in the app.
4. Create unique outline + original value (not competitor rewrites).
5. Implement content **and** SEO together:
   - `generateMetadata` (title ~580px preference, description ~920px preference, OG, keywords)
   - Matching JSON-LD via next-seo
   - Logical H1/H2, internal links, image alt, canonical-friendly URL
6. Run pre-publish audit (SEO-ENGINE §29).
7. Optional: Reticle-verify the live page.

## Page type → next-seo

| Page type | Prefer |
|-----------|--------|
| Blog / news / article | `ArticleJsonLd` |
| Company / brand | `OrganizationJsonLd` |
| Product / service | `ProductJsonLd` |
| FAQ | `FAQJsonLd` |
| Tutorial / steps | `HowToJsonLd` |
| Generic marketing | `generateMetadata` + Organization / WebSite as appropriate |

Meta tags: Next.js `generateMetadata`. JSON-LD: next-seo.

## Minimal App Router pattern

```tsx
import type { Metadata } from "next";
import { ArticleJsonLd } from "next-seo";

export function generateMetadata(): Metadata {
  return {
    title: "Clear topic | Brand",
    description: "Accurate, useful summary matching search intent.",
    keywords: ["primary topic", "related term"],
    openGraph: {
      title: "Clear topic | Brand",
      description: "Accurate, useful summary matching search intent.",
      type: "article",
    },
  };
}

export default function Page() {
  return (
    <>
      <ArticleJsonLd
        headline="Clear topic | Brand"
        datePublished="2026-01-01T08:00:00+00:00"
        author="Brand"
        description="Accurate, useful summary matching search intent."
        image="https://example.com/og.jpg"
      />
      {/* Human-reviewed, intent-satisfying content */}
    </>
  );
}
```

## MCP tools

- `seo_guidance` — loads SEO Engine + keywords + page-type hints
- `decide_tools` — may route to `seo_guidance`
- Target app: `next-seo` package

## Output checklist

- [ ] SEO-ENGINE research + pre-publish audit completed
- [ ] `next-seo` installed; metadata + JSON-LD shipped with content
- [ ] Intent satisfied; natural keywords; no stuffing
- [ ] Human review planned/done; no fabricated claims
- [ ] No ranking promises in copy or commits
