# Client Brief: El Abd Patisserie (حلواني العبد) — CONCEPT REDESIGN

> Unofficial concept redesign for portfolio/practice. Not affiliated with El Abd.
> Source of truth for content: src/data/site.json (pulled from elabdfoods.com, Sept 2026).

## Business
Name: El Abd Patisserie / حلواني العبد
Tagline (theirs): "الحلو صنعة" · Hero line on current site: "الحلو الي بجد بطعم العبد"
What they do: Egyptian patisserie since 1974. Oriental (sharqi) and Western sweets, fresh bakery, ice cream, seasonal Eid kahk and Mouled sweets, Ramadan yamish and nuts.
Story: First branch 1974 on Talaat Harb St, downtown Cairo. Second 1996 on 26th July St. From 2011, expanded into supermarket/hypermarket distribution (yamish, kahk, Mouled sweets, cookies). Branch expansion from Mall of Arabia (April 2019) to City Centre Almaza (May 2023): 11 branches across Cairo and Giza.
Service area: Greater Cairo + Giza (branches), delivery via website/app.

## Audience
Egyptian families buying for occasions (Eid, Mouled, Ramadan, birthdays, family visits), daily bakery/breakfast buyers, gift buyers.

## Pages
1. Home: hero, seasonal collection, category grid, best sellers, heritage strip, branches teaser
2. Menu / Shop: all categories with subcategories, product cards with price
3. Category page: template driven by site.json (one page per top-level category)
4. Seasonal: Mouled / Eid / Ramadan collection (currently Mouled is live)
5. Our Story: 1974 → today timeline (this IS a real sequence, numbered timeline is OK here)
6. Branches: list of 11 branches + hotline

## Main action
"Order" → for this concept, buttons link to hotline tel:17111 or the product on elabdfoods.com. NO real cart or checkout. A visual-only cart is out of scope.

## Languages
Arabic default (dir="rtl", lang="ar"). English toggle is a LATER /ship feature, not part of /new-site. Keep all copy in site.json so translation is a data change, not a rewrite.

## Brand
Logo: https://cdn.elabdfoods.com/abdproimages-blob/0000526_storeArabicLogo.png
Colors: derive from the logo. Not provided as hex.
Tone: warm, proud heritage, Egyptian family occasions. Not luxury-French, not fast-food.

## What's wrong with the current site (why this redesign exists)
- Stock nopCommerce storefront; logo alt text is literally "Your store name"
- Leftover template modals ("Popup Title / Popup content goes here") on every product
- Address bar shows placeholder "مكان العنوان"; "Payment methods" section is empty
- Heritage (since 1974, 11 branches) is buried on a text-only About page
- Seasonal collections (their biggest sales moments) are just another menu item
- No meta descriptions on inner pages

## Images
LOCAL DEV ONLY: hotlinking cdn.elabdfoods.com URLs from site.json is fine.
If this ever gets deployed: replace with own/stock photos and add a visible
"Concept redesign, not affiliated with El Abd" banner.

TODO (replace before deploy): one El Abd image is copied into the repo:
- public/images/elabd-logo.png (El Abd logo, from cdn.elabdfoods.com), used as the site favicon;
  public/favicon.ico is generated from it.
