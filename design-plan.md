# Design plan — El Abd concept

## Palette (from the logo roundel + the shop's world)
| Name | Hex | Role |
|---|---|---|
| Abd Maroon | `#7A1E2C` | Logo ink. Headings, buttons, ribbon, links |
| Maroon Deep | `#4E111B` | Hover/pressed, seasonal band background |
| Box Rose | `#F2D6D3` | Logo roundel = the pink cake box. Hero, image wells |
| Semn Cream | `#FBF6EF` | Page background (ghee/butter cream, not white) |
| Kahk Crust | `#C08A4E` | Decorative only (timeline rule, ribbon edge). Never text on cream (fails AA) |
| Qahwa | `#2B1A17` | Body text |

Contrast: maroon on cream ≈ 11:1, maroon on rose ≈ 8:1, cream on maroon-deep ≈ 15:1. All AA+.

## Type
- **Aref Ruqaa** (display): Ruqaa is the hand-lettered script of Cairo shop signs and the logo itself. h1 + section headings only.
- **IBM Plex Sans Arabic** (body/UI): calm, legible at small sizes, good weights.
- Fallbacks: `Amiri, serif` / `"Segoe UI", Tahoma, "Geeza Pro", sans-serif`.
- Digits: **Arabic-Indic everywhere** (٥٥ ج.م., ١٩٧٤, ١٧١١١). `tel:` hrefs keep Latin digits.

## The one bold idea: the hero is the lid of the pink El Abd box
Rose panel with a maroon ribbon tied across it: a vertical band at the inline-end and a horizontal
band along the bottom printed with "الحلو صنعة · منذ ١٩٧٤" on repeat. The round logo sits on the knot
where they cross. Huge Ruqaa h1. Nothing else on the site gets that treatment.

```
┌──────────────────────────────────────────┐
│                                  ┃▌▌┃   │  (RTL: text starts right,
│   الحلو اللي بجد بطعم العبد        ┃▌▌┃   │   ribbon at inline-end = left)
│   الحلو صنعة، من ١٩٧٤ ...          ┃▌▌┃   │
│   [اطلب على ١٧١١١] [شوف المنيو]     ┃▌▌┃   │
│━━━━━ الحلو صنعة · منذ ١٩٧٤ · ━━━━━━( ◉ )━━│  ← ribbon + logo knot
└──────────────────────────────────────────┘
```

## Pages
- **Home**: box-lid hero → seasonal band (maroon-deep, Mouled boxes + chips) → category grid
  (photo tiles where site.json has an image, rose tiles with Ruqaa name where it doesn't) →
  best sellers as a horizontal snap-scroll shelf → heritage strip (big "١٩٧٤" + 1 line + link) →
  branches teaser (11 names inline + hotline).
- **Menu**: h1, sticky chip jump-nav of categories, then one section per category: subcategory
  list, its products (from best_sellers + new_products), link to category page.
- **Category** `/menu/[slug]`: h1 name, subcategories, products or a "call the hotline" note when
  site.json has none.
- **Seasonal**: active season from `seasonal.active`; subcategories + products; order via hotline.
- **Story**: numbered timeline (a real sequence), year in Ruqaa, kahk-coloured rule down the inline-start.
- **Branches**: 11 branches, each linking to a Google Maps search; hotline + hours up top.

## Checked against CLAUDE.md design rules
- No eyebrow labels (Arabic has no caps; also no small kicker lines over headings).
- No single-word colour accents in headlines.
- Cards: no shadows, no uniform rounded boxes. Products sit on a rose image well with a hairline rule.
- No scroll/fade animations at all; only hover colour transitions, disabled under reduced motion.
- Numbered markers only on the Story timeline.
- Boldness is spent on the hero ribbon; everything else is cream, maroon, and type.
