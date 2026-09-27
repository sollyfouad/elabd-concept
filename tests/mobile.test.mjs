import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Phone layout checks that are visible in the built HTML/CSS. "Phone" = below Tailwind's md (48rem).
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const site = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/site.json'), 'utf8'));
const season = site.seasonal[site.seasonal.active];
const storeProductsList = [...site.best_sellers, ...site.new_products, ...site.catalog, ...season.products];
const paths = ['', 'menu', 'seasonal', 'story', 'branches', 'cart', 'checkout', 'search', ...site.categories.map((c) => `menu/${c.slug}`), ...storeProductsList.map((p) => `products/${p.slug}`)];
const pages = paths.flatMap((p) => ['ar', 'en'].map((lang) => ({
  lang, p, html: fs.readFileSync(path.join(DIST, lang === 'en' ? 'en' : '', p, 'index.html'), 'utf8'),
})));
const home = (lang) => pages.find((x) => x.p === '' && x.lang === lang).html;
const classesOf = (tag) => ((tag.match(/class="([^"]*)"/) || [])[1] || '').split(/\s+/);

test('mobile: header is sticky at the top on phones and static on desktop, with one call link and an icon-only menu button', () => {
  for (const { lang, p, html } of pages) {
    const header = html.match(/<header[^>]*>[\s\S]*?<\/header>/)[0];
    const cls = classesOf(header.match(/<header[^>]*>/)[0]);
    for (const c of ['sticky', 'top-0', 'md:static']) assert.ok(cls.includes(c), `${lang}/${p}: header lacks ${c}`);
    const call = header.match(/<a href="tel:[^"]*" aria-label="([^"]*)"[^>]*>/);
    assert.ok(call, `${lang}/${p}: no labelled call link in header`);
    assert.equal(call[1], `${site.ui[`call_${lang}`]} ${lang === 'en' ? '17111' : '١٧١١١'}`, `${lang}/${p}: call link label`);
    const menuToggleLabel = site.ui[`menu_toggle_${lang}`];
    const summaries = [...header.matchAll(/<summary([^>]*)>([\s\S]*?)<\/summary>/g)];
    const summary = summaries.find((m) => m[1].includes(`aria-label="${menuToggleLabel}"`));
    assert.ok(summary, `${lang}/${p}: no menu <summary> found by aria-label`);
    assert.equal(summary[2].replace(/<[^>]+>/g, '').trim(), '', `${lang}/${p}: menu button should be icon-only`);
    assert.ok(classesOf(header.match(/<header[^>]*>\s*<div[^>]*>/)[0].replace(/<header[^>]*>\s*/, '')).includes('whitespace-nowrap'),
      `${lang}/${p}: header row can wrap`);
  }
});

test('mobile: phone hero has a smaller h1, a short untruncated intro, and a fixed-size photo (no layout shift)', () => {
  for (const lang of ['ar', 'en']) {
    const hero = home(lang).match(/<section data-hero[\s\S]*?<\/section>/)[0];
    const h1 = classesOf(hero.match(/<h1[^>]*>/)[0]);
    assert.ok(h1.includes('text-4xl'), `${lang}: phone h1 should be text-4xl`);
    assert.doesNotMatch(hero, /line-clamp|truncate|text-ellipsis/, `${lang}: hero text is truncated with CSS`);
    const short = site.ui.home[`intro_short_${lang}`];
    assert.ok(short && !/…|\.\.\./.test(short), `${lang}: intro_short missing or has an ellipsis`);
    const shortP = hero.match(/<p class="([^"]*)">([^<]*)<\/p>/);
    assert.equal(shortP[2], short, `${lang}: phone intro should be intro_short`);
    assert.ok(classesOf(shortP[0]).includes('md:hidden'), `${lang}: short intro must be phones-only`);
    const fullP = hero.match(new RegExp(`<p class="([^"]*)">${site.ui.home[`intro_${lang}`].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</p>`));
    assert.ok(fullP && classesOf(fullP[0]).includes('hidden') && classesOf(fullP[0]).includes('md:block'), `${lang}: full intro must be md+ only`);
    const img = hero.match(/<img[^>]*data-hero-photo[^>]*>/)[0];
    const cls = classesOf(img);
    assert.ok(cls.includes('w-64') && cls.includes('aspect-square'), `${lang}: phone photo needs a fixed width and aspect ratio`);
    assert.match(img, /width="\d+" height="\d+"/, `${lang}: photo needs width/height attributes`);
  }
});

test('mobile: every link, button and summary is at least 44px tall (min-h-11 on a non-inline box)', () => {
  // Any variant counts (e.g. `hidden md:flex` is display:none on phones, flex above).
  const display = /(^|\s)([\w-]+:)?(block|flex|inline-flex|grid|inline-grid|inline-block)(\s|$)/;
  for (const { lang, p, html } of pages) {
    const visible = html.replace(/<ul[^>]*data-marquee-copy[\s\S]*?<\/ul>/, '');
    for (const m of visible.matchAll(/<(a|button|summary)\b([^>]*)>([\s\S]*?)<\/\1>/g)) {
      const cls = (m[2].match(/class="([^"]*)"/) || [, ''])[1];
      const text = m[3].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 40);
      assert.match(cls, /(^|\s)(focus:)?min-h-11(\s|$)/, `${lang}/${p}: <${m[1]}> "${text}" lacks min-h-11`);
      assert.match(cls, display, `${lang}/${p}: <${m[1]}> "${text}" is inline, so min-height has no effect`);
    }
  }
});

const builtCss = () => fs.readdirSync(path.join(DIST, '_astro')).filter((f) => f.endsWith('.css'))
  .map((f) => fs.readFileSync(path.join(DIST, '_astro', f), 'utf8')).join('\n');
// Lightning CSS may emit `(width < 48rem)`, `(max-width: 47.99…rem)` or `not all and (width>=48rem)`.
const PHONE_MQ = /@media (?:not all and \(width\s*>=\s*48rem\)|\(width\s*<\s*48rem\)|\(max-width:\s*47\.9\d*rem\))\s*\{/g;
function phoneBlocks(css) {
  const out = [];
  for (const m of css.matchAll(PHONE_MQ)) {
    let depth = 1; let i = m.index + m[0].length;
    for (; i < css.length && depth; i++) depth += css[i] === '{' ? 1 : css[i] === '}' ? -1 : 0;
    out.push(css.slice(m.index + m[0].length, i - 1));
  }
  return out.join('\n');
}

test('mobile: below md the best-sellers row does not auto-scroll and the clone is not rendered', () => {
  const phone = phoneBlocks(builtCss());
  assert.match(phone, /\.m-marquee\s*\{\s*animation:\s*none/, 'marquee still animates on phones');
  assert.match(phone, /\[data-marquee-copy\]\s*\{\s*display:\s*none/, 'marquee clone still rendered on phones');
  for (const lang of ['ar', 'en']) {
    const shelf = home(lang).match(/<div data-shelf[^>]*>/)[0];
    for (const c of ['overflow-x-auto', 'max-md:snap-x', 'max-md:snap-mandatory', 'max-md:scroll-px-4', 'max-md:-mx-4', 'max-md:px-4']) {
      assert.ok(classesOf(shelf).includes(c), `${lang}: shelf lacks ${c}`);
    }
    const items = [...home(lang).match(/<div data-shelf[\s\S]*?<ul data-marquee-copy/)[0].matchAll(/<li class="([^"]*)"/g)];
    assert.ok(items.length > 0 && items.every((m) => m[1].split(' ').includes('max-md:snap-start')), `${lang}: shelf cards lack snap-start`);
  }
});

test('mobile: product cards are positioned, so their sr-only text cannot widen the page from a scroll row', () => {
  for (const lang of ['ar', 'en']) {
    const articles = [...home(lang).matchAll(/<article class="([^"]*)"/g)];
    assert.ok(articles.length > 0 && articles.every((m) => m[1].split(' ').includes('relative')), `${lang}: product card not relative`);
  }
});

test('mobile: home teaser and /branches list every branch as one full-width tappable map row', () => {
  const enc = (bAr) => encodeURIComponent(`${site.brand.name_ar} ${bAr}`);
  for (const { lang, p, html } of pages.filter((x) => x.p === '' || x.p === 'branches')) {
    const main = html.match(/<main[\s\S]*<\/main>/)[0];
    const rows = [...main.matchAll(/<li class="([^"]*)">\s*<a href="(https:\/\/www\.google\.com\/maps\/search\/[^"]+)"[^>]*class="([^"]*)"[^>]*>([\s\S]*?)<\/a>\s*<\/li>/g)];
    assert.equal(rows.length, site.branches_ar.length, `${lang}/${p}: expected one row per branch`);
    rows.forEach((m, i) => {
      assert.ok(m[2].endsWith(enc(site.branches_ar[i])), `${lang}/${p}: row ${i} map link`);
      const cls = m[3].split(' ');
      assert.ok(cls.includes('flex') && cls.includes('min-h-11'), `${lang}/${p}: row ${i} is not a full-width 44px link`);
      const text = m[4].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      assert.ok(text.startsWith(`${site[`branches_${lang}`][i]} `), `${lang}/${p}: row ${i} label "${text}"`);
    });
    const list = main.match(/<ul class="([^"]*)">\s*<li class="[^"]*">\s*<a href="https:\/\/www\.google\.com\/maps/)[1].split(' ');
    assert.ok(!list.some((c) => /^(sm:)?grid-cols-[2-9]/.test(c)), `${lang}/${p}: branch list has columns below md`);
  }
});

test('mobile: the Mouled grid (home and /seasonal) leaves no orphan card at any breakpoint', () => {
  const BPS = ['', 'sm', 'md', 'lg', 'xl'];
  const at = (cls, prefix, bp) => { // value of `${bp}:${prefix}N` cascading up from base
    let v;
    for (const b of BPS.slice(0, BPS.indexOf(bp) + 1)) {
      const hit = cls.find((c) => c.startsWith(b ? `${b}:${prefix}` : prefix));
      if (hit) v = Number(hit.split(prefix)[1]);
    }
    return v;
  };
  const n = site.seasonal[site.seasonal.active].products.length;
  for (const { lang, p, html } of pages.filter((x) => x.p === '' || x.p === 'seasonal')) {
    const grid = [...html.matchAll(/<ul class="([^"]*grid-cols-[^"]*)">([\s\S]*?)<\/ul>/g)]
      .find((m) => (m[2].match(/<article/g) || []).length === n);
    assert.ok(grid, `${lang}/${p}: Mouled grid not found`);
    const ulCls = grid[1].split(' ');
    const liCls = [...grid[2].matchAll(/<li(?: class="([^"]*)")?>/g)].map((m) => (m[1] || '').split(' '));
    assert.equal(liCls.length, n, `${lang}/${p}: expected ${n} cards`);
    for (const bp of BPS) {
      const cols = at(ulCls, 'grid-cols-', bp);
      const cells = liCls.reduce((sum, c) => sum + (at(c, 'col-span-', bp) || 1), 0);
      assert.equal(cells % cols, 0, `${lang}/${p}: ${cells} cells in ${cols} columns at ${bp || 'base'} leaves an orphan`);
    }
  }
});

test('mobile: the logo seal is small on phones and the ribbon text stops before it', () => {
  const rem = (c, prefix) => Number(c.find((x) => x.startsWith(prefix))?.slice(prefix.length)) * 0.25;
  for (const lang of ['ar', 'en']) {
    const hero = home(lang).match(/<section data-hero[\s\S]*?<\/section>/)[0];
    const seal = classesOf(hero.match(/<img[^>]*m-knot-settle[^>]*>/)[0]);
    const text = classesOf(hero.match(/<div[^>]*m-ribbon-draw[^>]*>(?:\s|<!--[\s\S]*?-->)*<span[^>]*>/)[0].match(/<span[^>]*>/)[0]);
    const sealEnd = rem(seal, 'end-') + rem(seal, 'size-'); // rem from the ribbon's end edge to the seal's far side
    const textGap = rem(text, 'max-md:me-');
    assert.ok(rem(seal, 'size-') <= 2.5, `${lang}: phone seal larger than 40px`);
    assert.ok(textGap >= sealEnd, `${lang}: ribbon text (stops ${textGap}rem from the end) runs under the seal (${sealEnd}rem)`);
  }
});

test('mobile: categories use 2 columns of compact tiles on phones, with no spanning tile', () => {
  for (const lang of ['ar', 'en']) {
    const html = home(lang);
    const i = html.indexOf(`/menu/${site.categories[0].slug}"`);
    const grid = html.slice(html.lastIndexOf('<ul', i), html.indexOf('</ul>', i));
    const cls = classesOf(grid.match(/<ul[^>]*>/)[0]);
    assert.ok(cls.includes('grid-cols-2'), `${lang}: category grid is not 2 columns on phones`);
    assert.doesNotMatch(grid, /col-span-/, `${lang}: a category tile spans columns`);
    const tiles = [...grid.matchAll(/<a href="[^"]*\/menu\/[^"#]+" class="group block min-h-11">\s*<span[^>]*>\s*<img[^>]*class="([^"]*)"/g)];
    assert.equal(tiles.length, site.categories.length, `${lang}: expected a photo tile per category`);
    assert.ok(tiles.every((m) => m[1].split(' ').includes('aspect-[2/1]')), `${lang}: phone tiles should be compact 2:1`);
  }
});

test('mobile: the category grid leaves no orphan tile on phones or desktop', () => {
  for (const lang of ['ar', 'en']) {
    const html = home(lang);
    const i = html.indexOf(`/menu/${site.categories[0].slug}"`);
    const ulStart = html.lastIndexOf('<ul', i);
    const grid = html.slice(ulStart, html.indexOf('</ul>', i));
    const ulCls = classesOf(grid.match(/<ul[^>]*>/)[0]);
    const lis = [...grid.matchAll(/<li(?: class="([^"]*)")?>/g)].map((m) => (m[1] || '').split(' '));
    assert.equal(lis.length, site.categories.length, `${lang}: one tile per category`);
    for (const [bp, colsCls] of [['', 'grid-cols-'], ['md:', 'md:grid-cols-']]) {
      const cols = Number(ulCls.find((c) => c.startsWith(colsCls)).slice(colsCls.length));
      const cells = lis.reduce((sum, c) => {
        const span = c.find((x) => x.startsWith(`${bp}col-span-`)) ?? (bp ? c.find((x) => x.startsWith('col-span-')) : undefined);
        return sum + (span ? Number(span.split('col-span-')[1]) : 1);
      }, 0);
      assert.equal(cells % cols, 0, `${lang}: ${cells} cells in ${cols} columns at ${bp || 'base'} leaves an orphan`);
    }
  }
});
