import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const site = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/site.json'), 'utf8'));
const paths = ['', 'menu', 'seasonal', 'story', 'branches', ...site.categories.map((c) => `menu/${c.slug}`)];
const pages = paths.flatMap((p) => [['ar', p], ['en', p]]).map(([lang, p]) => ({
  lang, p, html: fs.readFileSync(path.join(DIST, lang === 'en' ? 'en' : '', p, 'index.html'), 'utf8'),
}));
const VOID = new Set('area base br col embed hr img input link meta source track wbr'.split(' '));

// Links as a screen reader sees them: skips aria-hidden/inert subtrees, name = aria-label or text + img alts.
function links(html) {
  const re = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>|([^<]+)/g;
  const stack = [];
  const out = [];
  let cur = null;
  let m;
  while ((m = re.exec(html))) {
    if (m[0].startsWith('<!--')) continue;
    const hiddenAbove = stack.some((s) => s.hidden);
    if (m[5] !== undefined) { if (cur && !hiddenAbove) cur.parts.push(m[5]); continue; }
    const [, close, tag, attrs, selfClose] = m;
    const t = tag.toLowerCase();
    if (close) {
      const i = stack.map((s) => s.tag).lastIndexOf(t);
      if (i >= 0) { const [top] = stack.splice(i); if (cur && top === cur.el) { out.push(cur); cur = null; } }
      continue;
    }
    const hidden = /aria-hidden="true"|\sinert(\s|$|=)/.test(attrs);
    if (t === 'img' && cur && !hiddenAbove && !hidden) {
      const alt = attrs.match(/alt="([^"]*)"/);
      if (alt && alt[1]) cur.parts.push(` ${alt[1]} `);
    }
    if (VOID.has(t) || selfClose) continue;
    const el = { tag: t, hidden };
    stack.push(el);
    if (t === 'a' && !hiddenAbove && !hidden) {
      const aria = attrs.match(/aria-label="([^"]*)"/);
      cur = { el, href: (attrs.match(/href="([^"]*)"/) || [])[1], parts: [], aria: aria && aria[1] };
    }
  }
  return out.map((l) => ({ href: l.href, name: (l.aria ?? l.parts.join(' ')).replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim() }));
}
const outsideHeader = (html) => html.replace(/<header[\s\S]*?<\/header>/, '');
const label = (item, lang) => item[lang];

test('a11y: the best-sellers marquee clone is aria-hidden and inert, and none of its links are exposed', () => {
  for (const { lang, p, html } of pages.filter((x) => x.p === '')) {
    const copies = html.match(/<ul[^>]*data-marquee-copy[^>]*>/g) || [];
    assert.equal(copies.length, 1, `${lang}: expected one marquee clone`);
    assert.match(copies[0], /aria-hidden="true"/, `${lang}: clone lacks aria-hidden="true"`);
    assert.match(copies[0], /\sinert(\s|>|=)/, `${lang}: clone lacks inert`);
    const names = links(html).map((l) => l.name);
    for (const b of site.best_sellers) {
      const n = names.filter((x) => x.includes(label(b, lang))).length;
      assert.ok(n <= 1, `${lang}/${p}: best seller "${label(b, lang)}" exposed in ${n} links (clone leaking?)`);
    }
  }
});

test('a11y: every category link on home pages is named exactly once by its category label', () => {
  for (const { lang, html } of pages.filter((x) => x.p === '')) {
    const ls = links(html);
    for (const c of site.categories) {
      const hits = ls.filter((l) => l.href && l.href.replace(/\/$/, '').endsWith(`/menu/${c.slug}`));
      assert.equal(hits.length, 1, `${lang}: expected 1 link to ${c.slug}, got ${hits.length}`);
      assert.equal(hits[0].name, label(c, lang), `${lang}: category link for ${c.slug} is read as "${hits[0].name}"`);
    }
  }
});

test('a11y: no link repeats its own label, and order links outside the header are unique per page', () => {
  const order = { ar: site.ui.order_ar, en: site.ui.order_en };
  for (const { lang, p, html } of pages) {
    for (const { name } of links(html)) {
      const w = name.split(' ');
      const half = w.length / 2;
      assert.ok(!(w.length > 1 && w.length % 2 === 0 && w.slice(0, half).join(' ') === w.slice(half).join(' ')),
        `${lang}/${p}: link label repeats itself: "${name}"`);
    }
    const orderNames = links(outsideHeader(html)).map((l) => l.name).filter((n) => n.startsWith(order[lang]));
    const dupes = orderNames.filter((n, i) => orderNames.indexOf(n) !== i);
    assert.deepEqual(dupes, [], `${lang}/${p}: order links read with the same label more than once`);
  }
});

test('a11y: every product photo has the product name as alt text in the page language', () => {
  const products = [...site.best_sellers, ...site.new_products, ...site.catalog, ...site.seasonal[site.seasonal.active].products];
  for (const { lang, p, html } of pages) {
    for (const m of html.matchAll(/<article[\s\S]*?<img src="([^"]+)" alt="([^"]*)"/g)) {
      const product = products.find((x) => x.img === m[1]);
      if (!product) continue;
      assert.equal(m[2].replace(/&amp;/g, '&'), label(product, lang), `${lang}/${p}: alt for ${m[1]}`);
    }
  }
});
