# Business Website Template

## Stack
- Astro + Tailwind. Static output. No React/Vue unless a feature truly needs interactivity.
- One .astro file per page in src/pages/. Shared pieces in src/components/.
- ALL content (names, prices, hours, story, branches, products) lives in src/data/site.json.
  Pages read from it. Never hardcode business content in a page.
- Dynamic category pages via src/pages/menu/[slug].astro + getStaticPaths from site.json.

## Arabic / RTL (default for Egyptian clients)
- <html lang="ar" dir="rtl">. Use Tailwind logical utilities (ms-/me-/ps-/pe-/start-/end-), never ml-/mr-/left-/right- for layout.
- Arabic-first typeface loaded via Google Fonts with a real fallback stack. Latin digits vs Arabic-Indic digits: pick one per site and be consistent.
- Icons that imply direction (arrows, chevrons) must flip in RTL.
- Prices: "55 ج.م." format, currency after the number.

## Standards (non-negotiable)
- Semantic HTML, one h1 per page, logical heading order, landmarks (header/nav/main/footer)
- WCAG AA contrast, visible focus states, meaningful alt text (never "Your store name" style junk)
- Mobile-first; check 375px, 768px, 1280px
- Unique <title> and meta description on every page
- Phone numbers are tel: links
- Respect prefers-reduced-motion
- No lorem ipsum, no leftover template text. Missing content -> TODO comment + list it in the report

## Design rules
- Derive palette and type from the brand and its world, not from generic defaults.
- Avoid template tells: ALL-CAPS eyebrow labels over every heading, one-word color accents in headlines,
  identical rounded cards with the same grey shadow everywhere, fade-up animation on every section,
  numbered 01/02/03 markers on things that aren't sequences.
- Spend boldness in one place (usually the hero). Keep the rest disciplined.

## Workflow
- New site from client-brief.md: /new-site
- New feature on an existing site: /ship <feature>
- Small tweaks: just ask directly, no pipeline
- Default branch is main.
