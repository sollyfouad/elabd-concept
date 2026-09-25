---
description: Build a full business site from client-brief.md and src/data/site.json
---
1. Read CLAUDE.md, client-brief.md, and src/data/site.json. If the brief is missing business name, pages, or main action, stop and list what's missing.
2. If site.json doesn't exist or is thin, fill it from the brief. If it exists, treat it as the source of truth and don't invent products or prices.
3. Before coding, write a short design plan to design-plan.md: 4-6 named hex colors, typefaces and roles, layout concept per page (ASCII wireframes OK), and the one bold idea. Check it against the "Design rules" in CLAUDE.md and revise anything generic.
4. Build: shared Layout (with lang/dir from the brief), Header, Footer, and every page listed in the brief. Category pages are generated from site.json.
5. Run `npm run build`. Fix all errors and warnings.
6. Report: pages built, the design plan in 5 lines, every TODO, and what I should check in the browser (especially RTL layout on mobile).
