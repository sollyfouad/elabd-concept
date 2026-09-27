// Product description data in site.json: descriptions that only restate the product name are
// dropped, translated descriptions add real content, no stray RTL punctuation, and every product
// still meets the Req 1-5 data rules.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const site = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/site.json'), 'utf8'));
const season = site.seasonal[site.seasonal.active];
const storeProducts = [...site.best_sellers, ...site.new_products, ...site.catalog, ...season.products];

function bySlug(slug) {
  const p = storeProducts.find((x) => x.slug === slug);
  assert.ok(p, `expected a product with slug ${slug}`);
  return p;
}

// ============================================================
// roasted-cashews-150-g and iced-caramel-latte-medium only restated the
// product's own name (spec 0.3 discard rule) and must have desc_ar/desc_en/translated removed, while
// keeping the independently-sourced fields (source_url, weight_g).
// ============================================================

test('roasted-cashews-150-g has no desc_ar/desc_en/translated (name-restating description discarded)', () => {
  const p = bySlug('roasted-cashews-150-g');
  assert.equal(p.desc_ar, undefined, 'desc_ar must be absent, not "" or null (Req 2)');
  assert.equal(p.desc_en, undefined, 'desc_en must be absent, not "" or null (Req 2)');
  assert.equal(p.translated, undefined, 'translated flag must be removed along with the description');
  assert.equal(p.source_url, 'https://elabdfoods.com/%D9%83%D8%A7%D8%AC%D9%88-%D9%85%D8%AD%D9%85%D8%B5-150-%D8%AC%D9%85',
    'source_url is sourced independently of the description and must be kept');
  assert.equal(p.weight_g, 150, 'weight_g is sourced independently of the description and must be kept');
});

test('iced-caramel-latte-medium has no desc_ar/desc_en/translated (name-restating description discarded)', () => {
  const p = bySlug('iced-caramel-latte-medium');
  assert.equal(p.desc_ar, undefined, 'desc_ar must be absent, not "" or null (Req 2)');
  assert.equal(p.desc_en, undefined, 'desc_en must be absent, not "" or null (Req 2)');
  assert.equal(p.translated, undefined, 'translated flag must be removed along with the description');
  assert.ok(p.source_url && p.source_url.startsWith('https://elabdfoods.com/'), 'source_url is sourced independently and must be kept');
});

test('neither product has a weight_g/pieces/gallery/desc key that is null, "" or []', () => {
  for (const slug of ['roasted-cashews-150-g', 'iced-caramel-latte-medium']) {
    const p = bySlug(slug);
    for (const key of ['source_url', 'desc_ar', 'desc_en', 'weight_g', 'pieces', 'gallery']) {
      if (key in p) {
        assert.notEqual(p[key], null, `${slug}.${key} must not be null`);
        assert.notEqual(p[key], '', `${slug}.${key} must not be ""`);
        if (Array.isArray(p[key])) assert.ok(p[key].length > 0, `${slug}.${key} must not be []`);
      }
    }
  }
});

// ============================================================
// coconut-150-g and peeled-almonds-150-g are genuine
// translations (each adds one fact beyond the name - "grated" / "American") and must keep
// desc_ar/desc_en/translated:"en", unlike the two discarded products above.
// ============================================================

test('coconut-150-g and peeled-almonds-150-g keep their translated descriptions (they add a fact beyond the name)', () => {
  const coconut = bySlug('coconut-150-g');
  assert.equal(coconut.desc_ar, 'جوزهند مبشور 150 جم');
  assert.equal(coconut.desc_en, 'Grated coconut, 150 g');
  assert.equal(coconut.translated, 'en');

  const almonds = bySlug('peeled-almonds-150-g');
  assert.equal(almonds.desc_ar, 'لوز امريكى 150 جرام');
  assert.equal(almonds.desc_en, 'American almonds, 150 g');
  assert.equal(almonds.translated, 'en');
});

// ============================================================
// No desc_ar/desc_en starts with a stray run of punctuation (an RTL layout artifact from the
// source site). Normal trailing sentence punctuation stays.
// ============================================================

const LEADING_PUNCT = /^[.,;:!\-–—]/;
const STRAY_PUNCT_SLUGS = [
  'mega-chocolate-croissant', 'chocolate-swiss-roll-gateau', 'chocolate-mousse-gateau',
  'jam-mille-feuille-gateau', 'mega-roumi-cheese-pateh', 'peach-gateau', 'sawabe-zeinab',
  'assorted-oriental-sweets-with-nuts', 'kunafa-with-nuts', 'kunafa-with-cream',
  'hazelnut-basbousa', 'premium-petit-four-32-pcs', 'ghorayeba-with-almonds-36-pcs',
  'latte-frappe-small', 'american-coffee-medium', 'flat-white-small', 'mocha-small',
];

test('no desc_ar/desc_en in storeProducts starts with a stray punctuation character', () => {
  for (const p of storeProducts) {
    for (const key of ['desc_ar', 'desc_en']) {
      if (p[key]) {
        assert.doesNotMatch(p[key], LEADING_PUNCT, `${p.slug}.${key} still starts with stray punctuation: ${JSON.stringify(p[key].slice(0, 15))}`);
      }
    }
  }
});

test('the 17 listed products still have their desc_ar text (only leading punctuation was stripped, wording intact)', () => {
  assert.equal(STRAY_PUNCT_SLUGS.length, 17);
  for (const slug of STRAY_PUNCT_SLUGS) {
    const p = bySlug(slug);
    assert.ok(p.desc_ar && p.desc_ar.length > 15, `${slug}: expected a real desc_ar to remain after trimming stray punctuation`);
    assert.ok(!LEADING_PUNCT.test(p.desc_ar), `${slug}: desc_ar must not start with stray punctuation`);
  }
});

test('legitimate trailing sentence punctuation is preserved (not stripped as if it were a leading artifact)', () => {
  const p = bySlug('el-abd-chocolate-cookies-30-pcs');
  assert.ok(p.desc_en.endsWith('vanilla.'), 'trailing sentence period must be preserved, only leading punctuation is stripped');
});

// ============================================================
// The core data requirements (Req 1-5) hold for the whole dataset.
// ============================================================

test('Req 1-5: every storeProducts entry still satisfies the data rules', () => {
  const slugRe = /^[a-z0-9]+(-[a-z0-9]+)*$/;
  const seenSlugs = new Map();
  for (const p of storeProducts) {
    assert.ok(p.slug && slugRe.test(p.slug), `${p.ar}: slug missing or malformed`);
    if (seenSlugs.has(p.slug)) {
      assert.equal(seenSlugs.get(p.slug), p.img, `slug ${p.slug} reused by a product with a different img`);
    } else {
      seenSlugs.set(p.slug, p.img);
    }
    assert.equal(!!p.desc_ar, !!p.desc_en, `${p.slug}: desc_ar/desc_en must both be present or both absent`);
    if (p.desc_en) assert.doesNotMatch(p.desc_en, /[؀-ۿ]/, `${p.slug}: desc_en contains Arabic characters`);
    if ('weight_g' in p) assert.ok(typeof p.weight_g === 'number' && p.weight_g > 0, `${p.slug}: weight_g must be a positive number`);
    if ('pieces' in p) assert.ok(Number.isInteger(p.pieces) && p.pieces > 0, `${p.slug}: pieces must be a positive integer`);
    if (p.gallery) {
      assert.ok(p.gallery.length >= 1 && p.gallery.length <= 6, `${p.slug}: gallery must have 1-6 entries`);
      const mainId = (p.img.match(/(\d{7})/) || [])[1];
      const ids = p.gallery.map((u) => (u.match(/(\d{7})/) || [])[1]);
      assert.ok(ids.every((id) => id !== mainId), `${p.slug}: a gallery entry shares its picture ID with img`);
      assert.equal(new Set(ids).size, ids.length, `${p.slug}: gallery entries share a picture ID with each other`);
      for (const u of p.gallery) assert.ok(u.startsWith('https://cdn.elabdfoods.com/'), `${p.slug}: gallery URL not a cdn.elabdfoods.com URL`);
    }
    if (p.desc_ar || p.desc_en || p.gallery) {
      assert.ok(p.source_url && p.source_url.startsWith('https://elabdfoods.com/'), `${p.slug}: has desc/gallery but no source_url`);
    }
  }
});
