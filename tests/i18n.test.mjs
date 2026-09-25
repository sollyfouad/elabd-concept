import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

const site = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/site.json'), 'utf8'));

const ARABIC_RE = /[؀-ۿ]/;

// Category slugs, in the same order site.json lists them.
const categorySlugs = site.categories.map((c) => c.slug);

// The 15 "P" paths from Req 2 (relative, no leading/trailing slash except '').
const paths = ['', 'menu', 'seasonal', 'story', 'branches', ...categorySlugs.map((s) => `menu/${s}`)];

function distFile(p) {
  // p is '' | 'menu' | 'menu/bakery' etc (Arabic side, unprefixed)
  return path.join(DIST, p, 'index.html');
}
function distFileEn(p) {
  return path.join(DIST, 'en', p, 'index.html');
}

function readPage(p) {
  return fs.readFileSync(distFile(p), 'utf8');
}
function readPageEn(p) {
  return fs.readFileSync(distFileEn(p), 'utf8');
}

// All 30 pages as { p, lang, file, html } for iteration.
function allPages() {
  const out = [];
  for (const p of paths) {
    out.push({ p, lang: 'ar', file: distFile(p), html: fs.readFileSync(distFile(p), 'utf8') });
    out.push({ p, lang: 'en', file: distFileEn(p), html: fs.readFileSync(distFileEn(p), 'utf8') });
  }
  return out;
}

function getHeader(html) {
  const m = html.match(/<header[\s\S]*?<\/header>/);
  assert.ok(m, 'expected a <header>...</header> block');
  return m[0];
}

function getBody(html) {
  const m = html.match(/<body[\s\S]*?<\/body>/);
  assert.ok(m, 'expected a <body>...</body> block');
  return m[0];
}

function getTitle(html) {
  const m = html.match(/<title>([\s\S]*?)<\/title>/);
  return m ? m[1] : null;
}

function getMetaDescription(html) {
  const m = html.match(/<meta name="description" content="([^"]*)"/);
  return m ? m[1] : null;
}

function getHtmlTag(html) {
  const m = html.match(/<html([^>]*)>/);
  assert.ok(m, 'expected <html ...>');
  return m[1];
}

// Extract every href="..." in the doc.
function allHrefs(html) {
  return [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);
}

function decodeEntities(s) {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

// ---- Req 2: 30 HTML files exist ----
test('Req 2: 30 pages exist (ar + en for each of 15 paths)', () => {
  assert.equal(paths.length, 15, 'expected 15 base paths derived from site.json categories');
  for (const p of paths) {
    assert.ok(fs.existsSync(distFile(p)), `missing dist/${p}/index.html`);
    assert.ok(fs.existsSync(distFileEn(p)), `missing dist/en/${p}/index.html`);
  }
});

// ---- Req 3: <html lang dir> ----
test('Req 3: every page has correct lang and dir on <html>', () => {
  for (const { p, lang, html } of allPages()) {
    const attrs = getHtmlTag(html);
    if (lang === 'ar') {
      assert.match(attrs, /lang="ar"/, `ar page /${p} missing lang="ar"`);
      assert.match(attrs, /dir="rtl"/, `ar page /${p} missing dir="rtl"`);
    } else {
      assert.match(attrs, /lang="en"/, `en page /${p} missing lang="en"`);
      assert.match(attrs, /dir="ltr"/, `en page /${p} missing dir="ltr"`);
    }
  }
});

// ---- Req 4: hreflang alternates ----
function normalizeAlt(pathname) {
  if (pathname === '/' || pathname === '/en/') return pathname;
  return pathname.replace(/\/+$/, '') || '/';
}

test('Req 4: every page has exactly 3 hreflang alternates, absolute, correct pathnames', () => {
  for (const { p, lang, html } of allPages()) {
    const links = [...html.matchAll(/<link rel="alternate" hreflang="(ar|en|x-default)" href="([^"]*)"\s*\/?>/g)];
    assert.equal(links.length, 3, `expected exactly 3 alternate links on ${lang}/${p}`);
    const byHreflang = Object.fromEntries(links.map((m) => [m[1], m[2]]));
    assert.ok(byHreflang.ar && byHreflang.en && byHreflang['x-default'], `missing one of ar/en/x-default on ${lang}/${p}`);
    for (const href of Object.values(byHreflang)) {
      const u = new URL(href);
      assert.equal(u.protocol, 'https:', `alternate href not absolute https: ${href}`);
    }
    const expectedAr = p === '' ? '/' : `/${p}`;
    const expectedEn = p === '' ? '/en/' : `/en/${p}`;
    assert.equal(normalizeAlt(new URL(byHreflang.ar).pathname), expectedAr, `ar alternate pathname wrong on ${lang}/${p}`);
    assert.equal(normalizeAlt(new URL(byHreflang.en).pathname), expectedEn, `en alternate pathname wrong on ${lang}/${p}`);
    assert.equal(normalizeAlt(new URL(byHreflang['x-default']).pathname), expectedAr, `x-default alternate pathname wrong on ${lang}/${p}`);
  }
});

test('Req 4: ar and en versions of the same page have identical alternate sets', () => {
  for (const p of paths) {
    const arHtml = readPage(p);
    const enHtml = readPageEn(p);
    const extract = (html) =>
      [...html.matchAll(/<link rel="alternate" hreflang="(ar|en|x-default)" href="([^"]*)"\s*\/?>/g)]
        .map((m) => [m[1], normalizeAlt(new URL(m[2]).pathname)])
        .sort();
    assert.deepEqual(extract(arHtml), extract(enHtml), `alternate sets differ between ar/en for path "${p}"`);
  }
});

// ---- Req 5: language switch anchor ----
test('Req 5: exactly one data-lang-switch anchor in <header>, with correct href/hreflang/lang/text', () => {
  for (const { p, lang, html } of allPages()) {
    const header = getHeader(html);
    const matches = [...header.matchAll(/<a\s[^>]*data-lang-switch[^>]*>([^<]*)<\/a>/g)];
    assert.equal(matches.length, 1, `expected exactly one data-lang-switch anchor in header on ${lang}/${p}`);
    const tag = matches[0][0];
    const text = matches[0][1];
    const hrefMatch = tag.match(/href="([^"]*)"/);
    assert.ok(hrefMatch, `data-lang-switch anchor missing href on ${lang}/${p}`);
    if (lang === 'ar') {
      const expectedHref = p === '' ? '/en/' : `/en/${p}`;
      assert.equal(hrefMatch[1], expectedHref, `ar->en switch href wrong on /${p}`);
      assert.match(tag, /hreflang="en"/);
      assert.match(tag, /lang="en"/);
      assert.equal(text, 'English');
    } else {
      const expectedHref = p === '' ? '/' : `/${p}`;
      assert.equal(hrefMatch[1], expectedHref, `en->ar switch href wrong on /en/${p}`);
      assert.match(tag, /hreflang="ar"/);
      assert.match(tag, /lang="ar"/);
      assert.equal(text, 'العربية');
    }
  }
});

// ---- Req 6: no JS inside <header> (scoped, not site-wide) ----
test('Req 6: no <script> or on*= handlers inside <header> on any page', () => {
  for (const { p, lang, html } of allPages()) {
    const header = getHeader(html);
    assert.doesNotMatch(header, /<script/i, `<script> found in header on ${lang}/${p}`);
    assert.doesNotMatch(header, /\son[a-z]+=/i, `on*= handler found in header on ${lang}/${p}`);
  }
});

// ---- Req 7: no Arabic characters anywhere on English pages (outside the lang-switch anchor) ----
test('Req 7: English pages contain no Arabic characters (title/description/alt/aria-label/body text)', () => {
  for (const { p, html } of allPages().filter((x) => x.lang === 'en')) {
    // Remove the single data-lang-switch anchor (its text is the Arabic word "العربية" by design).
    const withoutSwitch = html.replace(/<a\s[^>]*data-lang-switch[^>]*>[^<]*<\/a>/, '');

    const title = getTitle(withoutSwitch);
    assert.ok(title !== null, `no <title> on en/${p}`);
    assert.doesNotMatch(title, ARABIC_RE, `Arabic chars in <title> on en/${p}`);

    const desc = getMetaDescription(withoutSwitch);
    assert.ok(desc !== null, `no meta description on en/${p}`);
    assert.doesNotMatch(desc, ARABIC_RE, `Arabic chars in meta description on en/${p}`);

    for (const m of withoutSwitch.matchAll(/alt="([^"]*)"/g)) {
      assert.doesNotMatch(m[1], ARABIC_RE, `Arabic chars in alt="${m[1]}" on en/${p}`);
    }
    for (const m of withoutSwitch.matchAll(/aria-label="([^"]*)"/g)) {
      assert.doesNotMatch(m[1], ARABIC_RE, `Arabic chars in aria-label="${m[1]}" on en/${p}`);
    }

    const body = getBody(withoutSwitch);
    // Strip tags to check only text nodes; percent-encoded map URLs inside href="..." attributes
    // contain no raw Arabic characters so leaving attributes in would still be safe, but we scope
    // to text-between-tags per the requirement.
    const textOnly = body.replace(/<[^>]*>/g, ' ');
    assert.doesNotMatch(textOnly, ARABIC_RE, `Arabic chars in body text on en/${p}`);
  }
});

// ---- Req 8: Arabic title/description match site.json ----
function arabicTitleFor(p) {
  const pg = site.ui.pages;
  if (p === '') return pg.home.title_ar;
  if (p === 'menu') return pg.menu.title_ar;
  if (p === 'seasonal') return pg.seasonal.title_ar;
  if (p === 'story') return pg.story.title_ar;
  if (p === 'branches') return pg.branches.title_ar;
  const slug = p.replace(/^menu\//, '');
  const c = site.categories.find((x) => x.slug === slug);
  return `${c.ar} ${pg.category.title_suffix_ar}`;
}
function arabicDescriptionFor(p) {
  const pg = site.ui.pages;
  if (p === '') return pg.home.description_ar;
  if (p === 'menu') return pg.menu.description_ar;
  if (p === 'seasonal') return pg.seasonal.description_ar;
  if (p === 'story') return pg.story.description_ar;
  if (p === 'branches') return pg.branches.description_ar;
  const slug = p.replace(/^menu\//, '');
  const c = site.categories.find((x) => x.slug === slug);
  const subs = c.sub_ar || [];
  const cat = pg.category;
  return `${cat.description_prefix_ar} ${c.ar} ${cat.description_from_ar}${subs.length ? `: ${subs.join(site.ui.list_sep_ar)}` : ''}.`;
}

test('Req 8: Arabic <title> and <meta description> match site.json for every Arabic page', () => {
  for (const p of paths) {
    const html = readPage(p);
    assert.equal(getTitle(html), arabicTitleFor(p), `ar title mismatch on /${p}`);
    assert.equal(getMetaDescription(html), arabicDescriptionFor(p), `ar description mismatch on /${p}`);
  }
});

// ---- Req 9: unique titles, non-empty descriptions ----
test('Req 9: all 30 titles are unique and every page has a non-empty description', () => {
  const titles = allPages().map(({ p, lang, html }) => ({ p, lang, title: getTitle(html) }));
  for (const { p, lang, title } of titles) {
    assert.ok(title && title.length > 0, `empty/missing title on ${lang}/${p}`);
  }
  const titleValues = titles.map((t) => t.title);
  assert.equal(new Set(titleValues).size, titleValues.length, 'duplicate <title> found among the 30 pages');

  for (const { p, lang, html } of allPages()) {
    const desc = getMetaDescription(html);
    assert.ok(desc && desc.length > 0, `empty/missing meta description on ${lang}/${p}`);
  }
});

// ---- Req 10: exactly one <h1>, correct hero text on home ----
test('Req 10: every page has exactly one <h1>, home <h1> matches brand.hero_{ar,en}', () => {
  for (const { p, lang, html } of allPages()) {
    const h1s = [...html.matchAll(/<h1[\s>]/g)];
    assert.equal(h1s.length, 1, `expected exactly one <h1> on ${lang}/${p}`);
  }
  const arHome = readPage('');
  const enHome = readPageEn('');
  const h1ar = arHome.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)[1];
  const h1en = enHome.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)[1];
  assert.match(h1ar, new RegExp(escapeRe(site.brand.hero_ar)), 'ar home <h1> missing brand.hero_ar');
  assert.match(h1en, new RegExp(escapeRe(site.brand.hero_en)), 'en home <h1> missing brand.hero_en');
});

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ---- Req 11: internal links are localized ----
test('Req 11: every internal href on English pages starts with /en; Arabic pages never link to /en', () => {
  for (const { p, lang, html } of allPages()) {
    // Drop <link> tags (hreflang alternates) and the data-lang-switch anchor before scanning hrefs.
    const withoutLinkTags = html.replace(/<link\b[^>]*>/g, '');
    const withoutSwitch = withoutLinkTags.replace(/<a\s[^>]*data-lang-switch[^>]*>[\s\S]*?<\/a>/, '');
    const hrefs = allHrefs(withoutSwitch).filter((h) => h.startsWith('/'));
    if (lang === 'en') {
      for (const h of hrefs) {
        assert.ok(h.startsWith('/en/') || h === '/en', `en/${p} has un-localized internal href "${h}"`);
      }
    } else {
      for (const h of hrefs) {
        assert.ok(!h.startsWith('/en'), `ar/${p} has href into English site: "${h}"`);
      }
    }
  }
});

// ---- Req 12: prices formatted per language ----
test('Req 12: prices use Latin digits + EGP on English pages, Arabic-Indic digits + ج.م. on Arabic pages', () => {
  const enBakery = readPageEn('menu/bakery');
  const arBakery = readPage('menu/bakery');
  assert.match(enBakery, /55 EGP/, 'expected "55 EGP" in dist/en/menu/bakery/index.html');
  assert.match(arBakery, /٥٥ ج\.م\./, 'expected "٥٥ ج.م." in dist/menu/bakery/index.html');

  const enValuePacks = readPageEn('menu/value-packs');
  assert.match(enValuePacks, /139\.5 – 167\.4 EGP/, 'expected "139.5 – 167.4 EGP" in dist/en/menu/value-packs/index.html');
});

// ---- Req 13: tel: links unchanged ----
test('Req 13: every page has a tel:17111 link; English header shows "Order on 17111"', () => {
  for (const { p, lang, html } of allPages()) {
    assert.match(html, /href="tel:17111"/, `no tel:17111 link on ${lang}/${p}`);
  }
  for (const p of paths) {
    const header = getHeader(readPageEn(p));
    assert.match(header, /Order on 17111/, `English header missing "Order on 17111" text on en/${p}`);
  }
});

// ---- Req 14: data completeness in site.json ----
function walk(node, cb, pathSoFar = []) {
  if (node === null || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    node.forEach((v, i) => walk(v, cb, [...pathSoFar, i]));
    return;
  }
  cb(node, pathSoFar);
  for (const [k, v] of Object.entries(node)) {
    walk(v, cb, [...pathSoFar, k]);
  }
}

test('Req 14a/14b: every X_ar key has a same-typed X_en sibling; array siblings have equal length', () => {
  walk(site, (node, p) => {
    for (const key of Object.keys(node)) {
      if (key.endsWith('_ar')) {
        const base = key.slice(0, -3);
        const enKey = `${base}_en`;
        assert.ok(Object.prototype.hasOwnProperty.call(node, enKey), `missing "${enKey}" sibling for "${key}" at ${p.join('.')}`);
        const arVal = node[key];
        const enVal = node[enKey];
        const arType = Array.isArray(arVal) ? 'array' : typeof arVal;
        const enType = Array.isArray(enVal) ? 'array' : typeof enVal;
        assert.equal(enType, arType, `type mismatch for "${key}"/"${enKey}" at ${p.join('.')}`);
        if (arType === 'array') {
          assert.equal(enVal.length, arVal.length, `array length mismatch for "${key}"/"${enKey}" at ${p.join('.')}`);
        }
      }
    }
  });
});

test('Req 14c: every object with an "ar" key has a non-empty string "en"', () => {
  walk(site, (node, p) => {
    if (Object.prototype.hasOwnProperty.call(node, 'ar') && typeof node.ar === 'string') {
      assert.equal(typeof node.en, 'string', `"en" missing/not-a-string sibling for "ar" at ${p.join('.')}`);
      assert.ok(node.en.length > 0, `"en" is empty for "ar":"${node.ar}" at ${p.join('.')}`);
    }
  });
});

test('Req 14d: ui.pages.* has no remaining unsuffixed title/h1/description/title_suffix/description_prefix keys', () => {
  const banned = ['title', 'h1', 'description', 'title_suffix', 'description_prefix'];
  for (const [pageName, page] of Object.entries(site.ui.pages)) {
    for (const key of banned) {
      assert.ok(!Object.prototype.hasOwnProperty.call(page, key), `ui.pages.${pageName} still has unsuffixed "${key}"`);
    }
  }
});

// ---- Req 15: transliteration checks ----
test('Req 15: transliterated (not translated) traditional item names', () => {
  const all = [...site.best_sellers, ...site.new_products, ...site.catalog];
  const sawabe = all.find((x) => x.ar === 'صوابع زينب');
  assert.ok(sawabe, 'expected catalog item with ar === "صوابع زينب"');
  assert.equal(sawabe.en, 'Sawabe Zeinab');
  assert.doesNotMatch(sawabe.en, /finger/i);

  const basbousaItems = all.filter((x) => x.ar.includes('بسبوسة'));
  assert.ok(basbousaItems.length > 0, 'expected at least one بسبوسة item');
  for (const item of basbousaItems) {
    assert.match(item.en, /Basbousa/, `expected "Basbousa" in en for ar="${item.ar}"`);
  }

  const kunafaItems = all.filter((x) => x.ar.includes('كنافة'));
  assert.ok(kunafaItems.length > 0, 'expected at least one كنافة item');
  for (const item of kunafaItems) {
    assert.match(item.en, /Kunafa/, `expected "Kunafa" in en for ar="${item.ar}"`);
  }

  assert.equal(site.seasonal.mouled.title_en, 'Halawet El Mouled');
});

// ---- Req 16: every product appears by name on the site, in the right language ----
test('Req 16: all 64 products + 2 seasonal items appear by en name on an English page and ar name on an Arabic page', () => {
  const allProducts = [...site.best_sellers, ...site.new_products, ...site.catalog];
  assert.equal(allProducts.length, 64, `expected 64 products (7+14+43), got ${allProducts.length}`);
  const seasonalProducts = site.seasonal.mouled.products || site.seasonal.mouled.items || [];
  assert.ok(Array.isArray(seasonalProducts) && seasonalProducts.length === 2, 'expected 2 seasonal.mouled products');

  const allEnHtml = decodeEntities(paths.map((p) => readPageEn(p)).join('\n'));
  const allArHtml = decodeEntities(paths.map((p) => readPage(p)).join('\n'));

  const items = [...allProducts, ...seasonalProducts];
  for (const item of items) {
    assert.ok(allEnHtml.includes(item.en), `en name "${item.en}" (ar="${item.ar}") not found on any English page`);
    assert.ok(allArHtml.includes(item.ar), `ar name "${item.ar}" not found on any Arabic page`);
  }
});

// ---- Req 17: branches page ----
test('Req 17: English branches page lists all 11 branches_en names; map links keep the Arabic query', () => {
  const enBranches = readPageEn('branches');
  for (const name of site.branches_en) {
    assert.ok(decodeEntities(enBranches).includes(name), `branch "${name}" missing from dist/en/branches/index.html`);
  }
  const expectedQuery = encodeURIComponent(`${site.brand.name_ar} ${site.branches_ar[0]}`);
  assert.ok(enBranches.includes(expectedQuery), `expected percent-encoded Arabic map query "${expectedQuery}" in dist/en/branches/index.html`);
});

// ---- Req 1: package.json test script and unchanged deps ----
test('Req 1: package.json test script is exactly the spec\'d script, no new deps/devDeps', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts.test, 'astro build && node --test "tests/**/*.test.mjs"');

  const expectedDependencies = {
    '@tailwindcss/vite': '^4.3.3',
    astro: '^7.3.5',
    tailwindcss: '^4.3.3',
  };
  assert.deepEqual(pkg.dependencies, expectedDependencies, 'dependencies changed');
  assert.deepEqual(pkg.devDependencies, undefined, 'devDependencies should be absent');
});

// ---- Edge case 5: no literal "undefined" on English pages ----
test('Edge case 5: no English page renders the literal text "undefined"', () => {
  for (const p of paths) {
    const html = readPageEn(p);
    assert.doesNotMatch(html, /undefined/, `literal "undefined" found on en/${p}`);
  }
});

// ---- Edge case 6: empty subcategory arrays render no empty <ul> and no colon in description ----
test('Edge case 6: categories with empty sub arrays (value-packs, coffee, ice-cream-cakes) have no empty <ul> and description has no colon', () => {
  for (const slug of ['value-packs', 'coffee', 'ice-cream-cakes']) {
    const c = site.categories.find((x) => x.slug === slug);
    assert.equal(c.sub_en.length, 0, `expected sub_en to be empty for ${slug}`);
    for (const html of [readPage(`menu/${slug}`), readPageEn(`menu/${slug}`)]) {
      assert.doesNotMatch(html, /<ul[^>]*>\s*<\/ul>/, `empty <ul></ul> rendered for ${slug}`);
    }
    const enDesc = getMetaDescription(readPageEn(`menu/${slug}`));
    assert.doesNotMatch(enDesc, /:/, `en description for ${slug} should have no colon (no subcategories): "${enDesc}"`);
  }
  const coffeeDesc = getMetaDescription(readPageEn('menu/coffee'));
  assert.match(coffeeDesc, /section at El Abd Patisserie\.$/, `coffee en description should end with "section at El Abd Patisserie.": "${coffeeDesc}"`);
});
