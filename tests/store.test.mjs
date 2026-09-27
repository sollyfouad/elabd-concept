import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { localizeHref } from '../src/lib/i18n.js';
import { toPageDigits } from '../src/lib/price-format.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const SRC = path.join(ROOT, 'src');
const site = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/site.json'), 'utf8'));
const season = site.seasonal[site.seasonal.active];
const storeProducts = [...site.best_sellers, ...site.new_products, ...site.catalog, ...season.products];
const ARABIC_RE = /[؀-ۿ]/;

const categorySlugs = site.categories.map((c) => c.slug);
// The full extended path set (Req 13/14/30/33/34).
const paths = ['', 'menu', 'seasonal', 'story', 'branches', 'cart', 'checkout', 'search', ...categorySlugs.map((s) => `menu/${s}`), ...storeProducts.map((p) => `products/${p.slug}`)];

function distFile(p, lang) {
  return path.join(DIST, lang === 'en' ? 'en' : '', p, 'index.html');
}
function read(p, lang) {
  return fs.readFileSync(distFile(p, lang), 'utf8');
}
function label(item, lang) {
  return item[lang];
}
function t(obj, key, lang) {
  return obj[`${key}_${lang}`];
}
function numFmt(n, lang) {
  return Number(n).toLocaleString(lang === 'en' ? 'en-US' : 'ar-EG', { useGrouping: false });
}
function priceFmt(p, lang) {
  const currency = site[`currency_${lang}`];
  return `${numFmt(p.price, lang)}${p.price_to ? ` – ${numFmt(p.price_to, lang)}` : ''} ${currency}`;
}
function truncate(text) {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= 160) return flat;
  let cut = flat.slice(0, 157);
  const lastSpace = cut.lastIndexOf(' ');
  if (lastSpace > 0) cut = cut.slice(0, lastSpace);
  return `${cut}…`;
}
function decodeEntities(s) {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}
function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function getMain(html) {
  const m = html.match(/<main[\s\S]*?<\/main>/);
  assert.ok(m, 'expected a <main>...</main> block');
  return m[0];
}
function getTitle(html) {
  return (html.match(/<title>([\s\S]*?)<\/title>/) || [])[1];
}
function getMetaDescription(html) {
  return (html.match(/<meta name="description" content="([^"]*)"/) || [])[1];
}

// ============================================================
// Data rules (Req 1-5)
// ============================================================
test('Req 1: every storeProducts slug matches the pattern and is unique across different images', () => {
  const slugRe = /^[a-z0-9]+(-[a-z0-9]+)*$/;
  const bySlug = new Map();
  for (const p of storeProducts) {
    assert.match(p.slug, slugRe, `bad slug: ${p.slug}`);
    const existing = bySlug.get(p.slug);
    if (existing) assert.equal(existing.img, p.img, `slug collision on ${p.slug} with different img`);
    bySlug.set(p.slug, p);
  }
});

test('Req 2: no product has an empty-string/null/empty-array value among the optional fetched fields', () => {
  for (const p of storeProducts) {
    for (const key of ['source_url', 'desc_ar', 'desc_en', 'weight_g', 'pieces', 'gallery']) {
      if (!(key in p)) continue;
      const v = p[key];
      assert.notEqual(v, null, `${key} is null on ${p.slug}`);
      assert.notEqual(v, '', `${key} is empty string on ${p.slug}`);
      if (Array.isArray(v)) assert.ok(v.length > 0, `${key} is empty array on ${p.slug}`);
    }
  }
});

test('Req 3: desc_ar iff desc_en; no desc_en contains Arabic characters', () => {
  for (const p of storeProducts) {
    assert.equal(Boolean(p.desc_ar), Boolean(p.desc_en), `desc_ar/desc_en mismatch on ${p.slug}`);
    if (p.desc_en) assert.doesNotMatch(p.desc_en, ARABIC_RE, `desc_en has Arabic on ${p.slug}`);
  }
});

test('Req 4: weight_g/pieces are positive; gallery URLs are cdn URLs, 1-6, no shared picture IDs', () => {
  const picId = (url) => (url.match(/(\d{7})/) || [])[1];
  for (const p of storeProducts) {
    if ('weight_g' in p) assert.ok(p.weight_g > 0, `weight_g not positive on ${p.slug}`);
    if ('pieces' in p) assert.ok(Number.isInteger(p.pieces) && p.pieces > 0, `pieces not a positive integer on ${p.slug}`);
    if ('gallery' in p) {
      assert.ok(p.gallery.length >= 1 && p.gallery.length <= 6, `gallery length out of range on ${p.slug}`);
      const mainId = picId(p.img);
      const seen = new Set();
      for (const url of p.gallery) {
        assert.match(url, /^https:\/\/cdn\.elabdfoods\.com\//, `gallery URL bad prefix on ${p.slug}: ${url}`);
        const id = picId(url);
        assert.notEqual(id, mainId, `gallery shares main picture ID on ${p.slug}`);
        assert.ok(!seen.has(id), `gallery has a duplicate picture ID on ${p.slug}`);
        seen.add(id);
      }
    }
  }
});

test('Req 5: any product with desc_*/gallery, or weight_g not visible in its own name, has a source_url', () => {
  for (const p of storeProducts) {
    const weightVisibleInName = p.weight_g && /\d/.test(p.ar) && /\d/.test(p.en);
    const needsSource = p.desc_ar || p.desc_en || p.gallery || (p.weight_g && !weightVisibleInName);
    if (needsSource) assert.match(p.source_url || '', /^https:\/\/elabdfoods\.com\//, `${p.slug} needs source_url`);
  }
});

// ============================================================
// Product pages (Req 7-12)
// ============================================================
test('Req 7: dist/products/<slug>/index.html and dist/en/products/<slug>/index.html exist for every slug', () => {
  for (const p of storeProducts) {
    assert.ok(fs.existsSync(distFile(`products/${p.slug}`, 'ar')), `missing ar product page for ${p.slug}`);
    assert.ok(fs.existsSync(distFile(`products/${p.slug}`, 'en')), `missing en product page for ${p.slug}`);
  }
});

test('Req 8: product page h1/title/meta description', () => {
  const pg = site.ui.pages.product;
  for (const lang of ['ar', 'en']) {
    for (const p of storeProducts) {
      const html = read(`products/${p.slug}`, lang);
      const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)];
      assert.equal(h1s.length, 1, `${lang}/${p.slug}: expected exactly one h1`);
      assert.equal(decodeEntities(h1s[0][1]), label(p, lang), `${lang}/${p.slug}: h1 text`);
      assert.equal(decodeEntities(getTitle(html)), `${label(p, lang)} ${t(pg, 'title_suffix', lang)}`, `${lang}/${p.slug}: title`);
      const desc = decodeEntities(getMetaDescription(html) || '');
      assert.ok(desc && desc.length > 0 && desc.length <= 160, `${lang}/${p.slug}: meta description length`);
      const expected = p[`desc_${lang}`]
        ? truncate(toPageDigits(p[`desc_${lang}`], lang))
        : truncate(t(pg, 'description_fallback', lang).replace('{name}', label(p, lang)).replace('{price}', priceFmt(p, lang)));
      assert.equal(desc, expected, `${lang}/${p.slug}: meta description content`);
    }
  }
});

test('Req 9: price, breadcrumb, description paragraphs, weight/pieces dl, no literal "undefined"', () => {
  const store = site.ui.store;
  const menuH1 = { ar: t(site.ui.pages.menu, 'h1', 'ar'), en: t(site.ui.pages.menu, 'h1', 'en') };
  const seasonsNav = site.ui.nav.find((n) => n.href === '/seasonal');
  for (const lang of ['ar', 'en']) {
    for (const p of storeProducts) {
      const html = read(`products/${p.slug}`, lang);
      const main = decodeEntities(getMain(html));
      assert.doesNotMatch(main, /undefined/, `${lang}/${p.slug}: literal "undefined" found`);
      assert.ok(main.includes(priceFmt(p, lang)), `${lang}/${p.slug}: price not shown`);

      const nav = main.match(/<nav aria-label="[^"]*"[^>]*>([\s\S]*?)<\/nav>/);
      assert.ok(nav, `${lang}/${p.slug}: no breadcrumb nav`);
      assert.ok(nav[0].includes(`aria-label="${t(site.ui, 'breadcrumb_label', lang)}"`), `${lang}/${p.slug}: breadcrumb aria-label`);
      if (p.category) {
        const cat = site.categories.find((c) => c.slug === p.category);
        assert.ok(nav[1].includes(menuH1[lang]), `${lang}/${p.slug}: breadcrumb missing Menu`);
        assert.ok(nav[1].includes(label(cat, lang)), `${lang}/${p.slug}: breadcrumb missing category`);
      } else {
        assert.ok(nav[1].includes(label(seasonsNav, lang)), `${lang}/${p.slug}: breadcrumb missing Seasons`);
      }
      assert.ok(nav[1].includes(label(p, lang)), `${lang}/${p.slug}: breadcrumb missing product name`);

      // Box contents (description, weight, pieces) sit in a collapsed <details> after the add-to-cart button.
      // Boxes and packs (products with a piece count) say "What's in the box"; everything else "Details".
      const heading = (key) => new RegExp(`<summary[^>]*>(?:(?!</summary>)[\\s\\S])*<h2[^>]*>${escapeRe(t(store, key, lang))}</h2>`);
      const descHeading = heading(p.pieces ? 'box_h' : 'details_h');
      assert.doesNotMatch(main, heading(p.pieces ? 'details_h' : 'box_h'), `${lang}/${p.slug}: wrong box/details heading`);
      if (p[`desc_${lang}`] || p.weight_g || p.pieces) {
        assert.ok(main.indexOf('data-add-to-cart') < main.indexOf('<details'), `${lang}/${p.slug}: add to cart must come before the box contents`);
        assert.doesNotMatch(main, /<details[^>]*\sopen/, `${lang}/${p.slug}: box contents should start collapsed`);
      }
      if (p[`desc_${lang}`]) {
        assert.match(main, descHeading, `${lang}/${p.slug}: expected description heading`);
        for (const para of toPageDigits(p[`desc_${lang}`], lang).split('\n\n')) {
          assert.ok(main.includes(`<p class="mt-2">${para}</p>`), `${lang}/${p.slug}: missing paragraph "${para}"`);
        }
      } else if (!p.weight_g && !p.pieces) {
        assert.doesNotMatch(main, descHeading, `${lang}/${p.slug}: unexpected box contents heading`);
      }

      if (p.weight_g) {
        assert.ok(main.includes(`${numFmt(p.weight_g, lang)} ${t(store, 'grams', lang)}`), `${lang}/${p.slug}: weight row`);
      } else {
        assert.doesNotMatch(main, new RegExp(escapeRe(t(store, 'weight', lang))), `${lang}/${p.slug}: unexpected weight row`);
      }
      if (p.pieces) {
        assert.ok(main.includes(`${numFmt(p.pieces, lang)} ${t(store, 'pieces_unit', lang)}`), `${lang}/${p.slug}: pieces row`);
      }
      if (!p.weight_g && !p.pieces) {
        assert.doesNotMatch(main, /<dl/, `${lang}/${p.slug}: unexpected <dl> with no weight/pieces`);
      }
    }
  }
});

test('Req 10: gallery main image + thumbnails, or none when no gallery', () => {
  for (const lang of ['ar', 'en']) {
    for (const p of storeProducts) {
      const html = read(`products/${p.slug}`, lang);
      const mainImg = html.match(/<img data-gallery-main[^>]*>/);
      assert.ok(mainImg, `${lang}/${p.slug}: no data-gallery-main img`);
      assert.match(mainImg[0], new RegExp(`src="${escapeRe(p.img)}"`));
      const altMatch = mainImg[0].match(/alt="([^"]*)"/);
      assert.ok(altMatch, `${lang}/${p.slug}: gallery main img has no alt`);
      assert.equal(decodeEntities(altMatch[1]), label(p, lang), `${lang}/${p.slug}: gallery main img alt`);
      assert.match(mainImg[0], /width="415"/);
      assert.match(mainImg[0], /height="415"/);

      const thumbs = [...html.matchAll(/<button type="button" data-gallery-thumb[^>]*>/g)];
      if (p.gallery) {
        assert.equal(thumbs.length, 1 + p.gallery.length, `${lang}/${p.slug}: thumbnail count`);
        assert.match(thumbs[0][0], /aria-pressed="true"/, `${lang}/${p.slug}: first thumb not pressed`);
        for (const th of thumbs.slice(1)) assert.match(th[0], /aria-pressed="false"/);
      } else {
        assert.equal(thumbs.length, 0, `${lang}/${p.slug}: unexpected thumbnails with no gallery`);
      }
    }
  }
});

test('Req 11: qty picker + add-to-cart button, no <form> in main', () => {
  for (const lang of ['ar', 'en']) {
    for (const p of storeProducts) {
      const html = read(`products/${p.slug}`, lang);
      const main = getMain(html);
      assert.doesNotMatch(main, /<form/, `${lang}/${p.slug}: <form> found in main`);
      assert.match(main, /<label for="qty"/);
      assert.match(main, new RegExp(`<input id="qty" type="text" inputmode="numeric" value="${numFmt(1, lang)}"`));
      assert.match(main, /data-qty-dec/);
      assert.match(main, /data-qty-inc/);
      assert.ok(main.includes(`data-add-to-cart="${p.slug}"`), `${lang}/${p.slug}: add-to-cart button`);
      assert.ok(main.includes('data-qty-input="qty"'), `${lang}/${p.slug}: add-to-cart qty-input wiring`);
    }
  }
});

test('Req 12: the only tel: link in <main> is inside <noscript>', () => {
  for (const lang of ['ar', 'en']) {
    for (const p of storeProducts) {
      const main = getMain(read(`products/${p.slug}`, lang));
      const telCount = (main.match(/href="tel:/g) || []).length;
      assert.equal(telCount, 1, `${lang}/${p.slug}: expected exactly one tel: link in main`);
      const noscript = main.match(/<noscript>([\s\S]*?)<\/noscript>/);
      assert.ok(noscript && noscript[1].includes('href="tel:'), `${lang}/${p.slug}: tel: link is not inside noscript`);
    }
  }
});

// ============================================================
// Cards (Req 13-14)
// ============================================================
test('Req 13/14: every product card links to its product page, has no tel: link, and exactly one add-to-cart button', () => {
  const listSep = { ar: site.ui.list_sep_ar, en: site.ui.list_sep_en };
  for (const lang of ['ar', 'en']) {
    for (const p of paths) {
      const html = read(p, lang);
      for (const m of html.matchAll(/<article[^>]*>([\s\S]*?)<\/article>/g)) {
        const art = m[0];
        const imgMatch = art.match(/<img src="([^"]+)"/);
        if (!imgMatch) continue;
        const product = storeProducts.find((x) => x.img === imgMatch[1]);
        if (!product) continue;
        assert.doesNotMatch(art, /href="tel:/, `${lang}/${p}: card for ${product.slug} has a tel: link`);
        const expectedHref = localizeHref(`/products/${product.slug}`, lang);
        assert.ok(art.includes(`href="${expectedHref}"`), `${lang}/${p}: card for ${product.slug} missing href ${expectedHref}`);
        const buttons = [...art.matchAll(/<button type="button" data-add-to-cart="([^"]+)"[^>]*>([\s\S]*?)<\/button>/g)];
        assert.equal(buttons.length, 1, `${lang}/${p}: expected exactly one add-to-cart button for ${product.slug}`);
        assert.equal(buttons[0][1], product.slug);
        const text = decodeEntities(buttons[0][2].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
        const expectedText = `${t(site.ui.store, 'add_to_cart', lang)}${listSep[lang]}${label(product, lang)}`.replace(/\s+/g, ' ').trim();
        assert.equal(text, expectedText, `${lang}/${p}: add-to-cart accessible text for ${product.slug}`);
      }
    }
  }
});

// ============================================================
// Header (Req 15-17)
// ============================================================
test('Req 15-16: header contains search/cart/lang-switch/menu in order; search form is role=search/method=get', () => {
  for (const lang of ['ar', 'en']) {
    for (const p of ['', 'cart', 'checkout', 'search']) {
      const html = read(p, lang);
      const header = html.match(/<header[\s\S]*?<\/header>/)[0];
      const searchToggle = header.indexOf(`aria-label="${t(site.ui.store, 'search_toggle', lang)}"`);
      const cartLink = header.indexOf(localizeHref('/cart', lang) === '/' ? 'data-cart-count' : `href="${localizeHref('/cart', lang)}"`);
      const langSwitch = header.indexOf('data-lang-switch');
      const menuToggle = header.indexOf(`aria-label="${t(site.ui, 'menu_toggle', lang)}"`);
      assert.ok(searchToggle !== -1 && cartLink !== -1 && langSwitch !== -1 && menuToggle !== -1, `${lang}/${p}: header missing one of the four controls`);
      assert.ok(searchToggle < cartLink && cartLink < langSwitch && langSwitch < menuToggle, `${lang}/${p}: header controls out of order`);
      assert.match(header, /name="header-panel"/g);
      assert.equal((header.match(/name="header-panel"/g) || []).length, 2, `${lang}/${p}: expected 2 details with name="header-panel"`);

      const form = header.match(/<form role="search"[^>]*>/);
      assert.ok(form, `${lang}/${p}: no header search form`);
      assert.match(form[0], /method="get"/);
      assert.match(form[0], new RegExp(`action="${(lang === 'en' ? '/en/search' : '/search').replace('/', '\\/')}"`));
      assert.match(header, /<label for="hdr-q"/);
      assert.match(header, /<input id="hdr-q" type="search" name="q"/);
    }
  }
});

test('Req 17: header phone call link number span has hidden sm:inline (icon-only at 375px)', () => {
  for (const lang of ['ar', 'en']) {
    for (const p of ['', 'cart', 'checkout', 'search']) {
      const html = read(p, lang);
      const header = html.match(/<header[\s\S]*?<\/header>/)[0];
      const callLink = header.match(/<a href="tel:[^"]+"[^>]*>[\s\S]*?<\/a>/);
      assert.ok(callLink, `${lang}/${p}: no tel: call link in header`);
      assert.match(callLink[0], /<span class="[^"]*\bhidden sm:inline\b[^"]*">/,
        `${lang}/${p}: phone call link's number span is missing hidden sm:inline`);
    }
  }
});

// ============================================================
// Cart page (Req 20)
// ============================================================
test('Req 20: /cart and /en/cart structure + catalog JSON per language', () => {
  for (const lang of ['ar', 'en']) {
    const html = read('cart', lang);
    const pg = site.ui.pages.cart;
    assert.ok(html.includes(`<h1 tabindex="-1"`) && html.includes(t(pg, 'h1', lang)), `${lang}: cart h1`);
    assert.match(html, /<ul data-cart-lines[^>]*><\/ul>/, `${lang}: expected an empty <ul data-cart-lines>`);
    const empty = html.match(/<div data-cart-empty[^>]*>([\s\S]*?)<\/div>/);
    assert.ok(empty, `${lang}: no data-cart-empty`);
    assert.ok(empty[1].includes(t(site.ui.store, 'empty', lang)));
    assert.ok(empty[1].includes(`href="${localizeHref('/menu', lang)}"`));
    assert.ok(empty[1].includes(t(site.ui.store, 'continue', lang)));
    assert.match(html, /<div role="status"[^>]*>\s*<p data-cart-total[^>]*><\/p>/);
    assert.ok(html.includes(`data-checkout-link href="${localizeHref('/checkout', lang)}"`), `${lang}: checkout link`);
    const catalogM = html.match(/<script type="application\/json" id="store-catalog">([\s\S]*?)<\/script>/);
    assert.ok(catalogM, `${lang}: no catalog JSON`);
    const catalog = JSON.parse(catalogM[1]);
    assert.deepEqual(Object.keys(catalog).sort(), storeProducts.map((p) => p.slug).sort());
    if (lang === 'en') assert.doesNotMatch(catalogM[1], ARABIC_RE, 'en catalog contains Arabic characters');
  }
});

// ============================================================
// Search page (Req 24)
// ============================================================
test('Req 24: /search and /en/search structure; every li has both names in data-search', () => {
  for (const lang of ['ar', 'en']) {
    const html = read('search', lang);
    const pg = site.ui.pages.search;
    assert.match(html, new RegExp(`<h1[^>]*>${t(pg, 'h1', lang)}</h1>`));
    const form = html.match(/<form role="search" method="get"[^>]*>/);
    assert.ok(form, `${lang}: no search form`);
    assert.match(html, /<label for="search-q"/);
    assert.match(html, /<input id="search-q" type="search" name="q"/);
    assert.match(html, /<p data-search-count role="status"[^>]*><\/p>/);
    assert.match(html, /<p data-search-empty hidden[^>]*>/);
    const lis = [...html.matchAll(/<li data-search="([^"]*)"/g)];
    assert.equal(lis.length, storeProducts.length, `${lang}: expected one li per store product`);
    for (const p of storeProducts) {
      assert.ok(lis.some((m) => m[1] === `${p.ar} ${p.en}`.replace(/&/g, '&amp;')), `${lang}: missing data-search entry for ${p.slug}`);
    }
  }
});

// ============================================================
// Checkout (Req 27-29)
// ============================================================
test('Req 27: checkout <main> has no form/textarea/select; only radio/text inputs; every button type=button; no action/formaction', () => {
  for (const lang of ['ar', 'en']) {
    const main = getMain(read('checkout', lang));
    assert.doesNotMatch(main, /<form/);
    assert.doesNotMatch(main, /<textarea/);
    assert.doesNotMatch(main, /<select/);
    const inputTypes = [...main.matchAll(/<input[^>]*\stype="([^"]*)"/g)].map((m) => m[1]);
    assert.ok(inputTypes.length > 0);
    for (const type of inputTypes) assert.ok(type === 'radio' || type === 'text', `unexpected input type ${type}`);
    for (const m of main.matchAll(/<input[^>]*\stype="text"[^>]*>/g)) {
      assert.match(m[0], /autocomplete="off"/);
      const idMatch = m[0].match(/\sid="([^"]*)"/);
      assert.ok(idMatch, 'text input missing id');
      // No name attribute: nothing the user types can be serialised or submitted.
      assert.doesNotMatch(m[0], /\sname=/, `text input #${idMatch[1]} has a name attribute`);
      assert.ok(main.includes(`for="${idMatch[1]}"`), `no label for ${idMatch[1]}`);
    }
    const buttonTypes = [...main.matchAll(/<button[^>]*\stype="([^"]*)"/g)].map((m) => m[1]);
    for (const type of buttonTypes) assert.equal(type, 'button');
    assert.doesNotMatch(main, /\s(action|formaction)=/);
  }
});

test('Checkout: name and phone fields exist, only radios carry a name, and there are no card fields', () => {
  const store = site.ui.store;
  for (const lang of ['ar', 'en']) {
    const main = getMain(read('checkout', lang));
    for (const id of ['cust-name', 'cust-phone']) {
      const input = main.match(new RegExp(`<input[^>]*\\sid="${id}"[^>]*>`));
      assert.ok(input, `${lang}: missing #${id}`);
      assert.match(input[0], /autocomplete="off"/, `${lang}: #${id} must have autocomplete="off"`);
    }
    assert.ok(main.includes(t(store, 'contact_note', lang)), `${lang}: missing "not saved or sent" note for name/phone`);
    for (const m of main.matchAll(/<input[^>]*\sname="([^"]*)"[^>]*>/g)) {
      assert.match(m[0], /type="radio"/, `${lang}: only radio inputs may have a name (found name="${m[1]}")`);
      assert.ok(['method', 'branch', 'slot', 'payment'].includes(m[1]), `${lang}: unexpected radio group ${m[1]}`);
    }
    const payments = t(store, 'payments', lang);
    assert.equal([...main.matchAll(/name="payment"/g)].length, payments.length, `${lang}: payment radio count`);
    for (const pay of payments) assert.ok(main.includes(pay), `${lang}: missing payment option "${pay}"`);
    // No card data entry of any kind.
    assert.doesNotMatch(main, /autocomplete="cc-|id="[^"]*(card|cvv|cvc|expir)[^"]*"|placeholder="[^"]*(card|CVV|MM\/YY)/i, `${lang}: card fields found`);
  }
});

test('Req 28: checkout step structure (ol, 3 sections, method/branch/slot radios, summary block, empty state, catalog)', () => {
  for (const lang of ['ar', 'en']) {
    const html = read('checkout', lang);
    const main = getMain(html);
    const store = site.ui.store;
    assert.match(main, new RegExp(`<ol aria-label="${escapeRe(t(store, 'steps_label', lang))}"`));
    const olLis = [...main.matchAll(/<li data-step-indicator="\d"[^>]*>/g)];
    assert.equal(olLis.length, 3, 'expected 3 step indicators');
    assert.equal(olLis.filter((m) => m[0].includes('aria-current="step"')).length, 1);

    for (const n of [1, 2, 3]) {
      assert.match(main, new RegExp(`<section data-step="${n}" data-step-section[^>]*>`));
    }
    assert.match(main, new RegExp(`<h2 tabindex="-1"[^>]*>${escapeRe(t(store, 'step_area', lang))}</h2>`));
    assert.match(main, new RegExp(`<legend[^>]*>${escapeRe(t(store, 'method_legend', lang))}</legend>`));
    assert.equal([...main.matchAll(/name="method"/g)].length, 2);

    const branches = t(site, 'branches', lang);
    assert.equal([...main.matchAll(/name="branch"/g)].length, branches.length, 'branch radio count must equal branches count');
    for (const b of branches) assert.ok(main.includes(b), `missing branch label "${b}"`);
    assert.match(main, new RegExp(escapeRe(t(store, 'address_note', lang))));

    const slots = t(store, 'slots', lang);
    assert.equal([...main.matchAll(/name="slot"/g)].length, slots.length);

    assert.match(main, new RegExp(`<h2[^>]*>${escapeRe(t(store, 'step_summary', lang))}</h2>`));
    assert.match(main, /<ul data-summary-lines[^>]*><\/ul>/);
    assert.match(main, /<p data-summary-total[^>]*><\/p>/);
    assert.match(main, /<dl data-summary-details[^>]*><\/dl>/);
    assert.match(main, /<p data-summary-fee hidden[^>]*><\/p>/);
    for (const [attr, key] of [['data-back', 'back'], ['data-edit-details', 'edit_details'], ['data-confirm', 'confirm']]) {
      assert.match(main, new RegExp(`<button type="button" ${attr}[^>]*>${escapeRe(t(store, key, lang))}</button>`), `${lang}: missing ${attr} button`);
    }
    const confirmed = main.match(/<section data-confirmed hidden[^>]*>([\s\S]*?)<\/section>/);
    assert.ok(confirmed, `${lang}: no hidden confirmation section`);
    assert.ok(confirmed[1].includes(t(store, 'confirmed_body', lang)), `${lang}: confirmation must say it is a demo`);
    assert.match(confirmed[1], /<dl data-confirmed-details[^>]*><\/dl>/, `${lang}: confirmation needs an order details list`);
    assert.ok(confirmed[1].includes(`href="${site.contact.real_site}"`) && confirmed[1].includes('href="tel:17111"'), `${lang}: confirmation links`);
    const notice = main.match(/<div data-concept-notice[^>]*>([\s\S]*?)<\/div>\s*<\/section>/);
    assert.ok(notice, 'no data-concept-notice block');
    assert.ok(notice[1].includes(t(store, 'concept_order', lang)));
    assert.ok(notice[1].includes(`href="${site.contact.real_site}"`));
    assert.ok(notice[1].includes('href="tel:17111"'));

    const empty = main.match(/<div data-checkout-empty[^>]*>([\s\S]*?)<\/div>/);
    assert.ok(empty && empty[1].includes(t(store, 'empty', lang)));

    assert.match(html, /<script type="application\/json" id="store-catalog">/);

    for (const row of main.matchAll(/<label class="([^"]*)"><input type="radio"/g)) {
      const cls = row[1].split(' ');
      assert.ok(cls.includes('min-h-11'), 'radio row missing min-h-11');
    }
  }
});

test('Req 29: checkout.js contains none of the forbidden storage/network tokens', () => {
  const src = fs.readFileSync(path.join(SRC, 'scripts/checkout.js'), 'utf8');
  // Its one write is emptying the cart when the demo order is confirmed.
  assert.equal(src.split('clearCart()').length - 1, 1, 'clearCart() should be called exactly once (on confirm)');
  for (const token of ['saveCart', 'setItem', 'sessionStorage', 'document.cookie', 'fetch(', 'XMLHttpRequest', 'sendBeacon', 'WebSocket', '.submit(']) {
    assert.ok(!src.includes(token), `checkout.js must not contain "${token}"`);
  }
});

// ============================================================
// Script placement (Req 30), import graph resolved
// ============================================================
const fileCache = new Map();
function readCached(file) {
  if (!fileCache.has(file)) fileCache.set(file, fs.readFileSync(file, 'utf8'));
  return fileCache.get(file);
}

function resolveScriptText(html) {
  const visited = new Set();
  const texts = [];

  function visitSpecifiers(code, baseDir) {
    const re = /from\s*["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)|import\s*["']([^"']+)["']/g;
    for (const m of code.matchAll(re)) {
      const spec = m[1] || m[2] || m[3];
      const full = spec.startsWith('/') ? path.join(DIST, spec.replace(/^\//, '')) : path.resolve(baseDir, spec);
      if (visited.has(full) || !fs.existsSync(full)) continue;
      visited.add(full);
      const content = readCached(full);
      texts.push(content);
      visitSpecifiers(content, path.dirname(full));
    }
  }

  for (const m of html.matchAll(/<script((?:(?!type="application\/(?:ld\+json|json)")[^>])*)>([\s\S]*?)<\/script>/g)) {
    const attrs = m[1];
    const body = m[2];
    const srcMatch = attrs.match(/\ssrc="([^"]+)"/);
    if (srcMatch) {
      const full = path.join(DIST, srcMatch[1].replace(/^\//, ''));
      if (visited.has(full) || !fs.existsSync(full)) continue;
      visited.add(full);
      const content = readCached(full);
      texts.push(content);
      visitSpecifiers(content, path.dirname(full));
    } else if (body.trim()) {
      texts.push(body);
      visitSpecifiers(body, DIST);
    }
  }
  return texts.join('\n');
}

test('Req 30: cart-count.js is present on every page, ar + en', () => {
  for (const lang of ['ar', 'en']) {
    for (const p of paths) {
      const text = resolveScriptText(read(p, lang));
      assert.match(text, /elabd-cart-v1/, `${lang}/${p}: cart-count signature missing`);
    }
  }
});

test('Req 30: cart-ui.js is present on cart-changing pages, absent on story/branches', () => {
  const cartUiPages = new Set(['', 'menu', 'seasonal', 'cart', 'checkout', 'search', ...categorySlugs.map((s) => `menu/${s}`), ...storeProducts.map((p) => `products/${p.slug}`)]);
  for (const lang of ['ar', 'en']) {
    for (const p of paths) {
      const text = resolveScriptText(read(p, lang));
      if (cartUiPages.has(p)) {
        assert.match(text, /data-add-to-cart/, `${lang}/${p}: cart-ui signature missing`);
      } else {
        assert.doesNotMatch(text, /data-add-to-cart/, `${lang}/${p}: cart-ui signature unexpectedly present`);
        assert.doesNotMatch(text, /setItem/, `${lang}/${p}: setItem unexpectedly present`);
      }
    }
  }
});

test('Req 30/26: [data-search-results] appears in scripts only on the search pages', () => {
  for (const lang of ['ar', 'en']) {
    for (const p of paths) {
      const text = resolveScriptText(read(p, lang));
      if (p === 'search') assert.match(text, /\[data-search-results\]/, `${lang}/${p}: search signature missing`);
      else assert.doesNotMatch(text, /\[data-search-results\]/, `${lang}/${p}: search signature unexpectedly present`);
    }
  }
});

test('Req 30: /branches has only cart-count; /story has cart-count + the timeline script', () => {
  for (const lang of ['ar', 'en']) {
    const branchesText = resolveScriptText(read('branches', lang));
    assert.match(branchesText, /elabd-cart-v1/);
    assert.doesNotMatch(branchesText, /data-add-to-cart/);
    assert.doesNotMatch(branchesText, /data-timeline/);

    const storyText = resolveScriptText(read('story', lang));
    assert.match(storyText, /elabd-cart-v1/);
    assert.match(storyText, /data-timeline/);
    assert.doesNotMatch(storyText, /data-add-to-cart/);
  }
});

// ============================================================
// Logical utilities + outline-none (Req 35, 37)
// ============================================================
const CHECKED_FILES = [
  'src/layouts/Layout.astro',
  'src/components/Header.astro',
  'src/components/ProductCard.astro',
  'src/components/views/HomeView.astro',
  'src/components/views/MenuView.astro',
  'src/components/views/CategoryView.astro',
  'src/components/views/SeasonalView.astro',
  'src/components/views/ProductView.astro',
  'src/components/views/CartView.astro',
  'src/components/views/CheckoutView.astro',
  'src/components/views/SearchView.astro',
  'src/pages/products/[slug].astro',
  'src/pages/en/products/[slug].astro',
  'src/pages/cart.astro',
  'src/pages/en/cart.astro',
  'src/pages/checkout.astro',
  'src/pages/en/checkout.astro',
  'src/pages/search.astro',
  'src/pages/en/search.astro',
];

test('Req 35: new/changed .astro files use only logical (start/end) utilities, never physical ml-/mr-/pl-/pr-/left-/right-/text-left/text-right', () => {
  const banned = ['ml-', 'mr-', 'pl-', 'pr-', 'left-', 'right-', 'text-left', 'text-right'];
  for (const rel of CHECKED_FILES) {
    const content = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    for (const token of banned) {
      assert.ok(!content.includes(`"${token}`) && !content.includes(` ${token}`), `${rel} contains banned utility "${token}"`);
    }
  }
});

test('Req 37: no outline-none in the new/changed files', () => {
  for (const rel of CHECKED_FILES) {
    const content = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    assert.ok(!content.includes('outline-none'), `${rel} contains outline-none`);
  }
});

// ============================================================
// Digits: Arabic pages show Arabic-Indic digits everywhere a reader can see them.
// ============================================================
function arPages(dir = DIST) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return full === path.join(DIST, 'en') ? [] : arPages(full);
    return e.name === 'index.html' ? [full] : [];
  });
}

test('Arabic pages: no Latin digits in visible text, meta text, or user-facing attributes', () => {
  const pages = arPages();
  assert.ok(pages.length > storeProducts.length + 10, `expected every Arabic page to be scanned (got ${pages.length})`);
  for (const file of pages) {
    const html = fs.readFileSync(file, 'utf8').replace(/<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>/g, '');
    const where = path.relative(DIST, file);
    for (const m of html.matchAll(/>([^<]+)</g)) {
      assert.doesNotMatch(decodeEntities(m[1]), /[0-9]/, `${where}: Latin digits in text "${m[1].trim().slice(0, 60)}"`);
    }
    for (const m of html.matchAll(/<(\w+)([^>]*)>/g)) {
      const [, tag, attrs] = m;
      if (tag === 'input' && /type="radio"/.test(attrs)) continue; // radio values are never displayed
      for (const a of attrs.matchAll(/\s(value|placeholder|alt|title|aria-label)="([^"]*)"/g)) {
        assert.doesNotMatch(a[2], /[0-9]/, `${where}: Latin digits in ${tag} ${a[1]}="${a[2]}"`);
      }
      if (tag === 'meta' && /(name="description"|property="og:(title|description)")/.test(attrs)) {
        const content = attrs.match(/content="([^"]*)"/);
        assert.doesNotMatch(content[1], /[0-9]/, `${where}: Latin digits in ${attrs.trim().slice(0, 40)}`);
      }
    }
  }
});

test('cart and product scripts write quantities through formatNum (page digits)', () => {
  for (const f of ['cart-page.js', 'product-page.js']) {
    const src = fs.readFileSync(path.join(SRC, 'scripts', f), 'utf8');
    assert.doesNotMatch(src, /\.value = String\(/, `${f}: a quantity is written with String(), not formatNum`);
  }
});

// ============================================================
// Cart badge: screen readers hear the count once (from the sr-only label), never the badge too.
// ============================================================
test('header cart link: badge number is aria-hidden, so the count is announced once', () => {
  const store = site.ui.store;
  for (const lang of ['ar', 'en']) {
    for (const p of paths) {
      const html = read(p, lang);
      const link = html.match(new RegExp(`<a href="${escapeRe(localizeHref('/cart', lang))}"[^>]*>([\\s\\S]*?)</a>`));
      assert.ok(link, `${lang}/${p}: no header cart link`);
      assert.match(link[1], /<span data-cart-count aria-hidden="true"/, `${lang}/${p}: cart badge must be aria-hidden`);
      // What a screen reader gets: the link's text minus aria-hidden subtrees (badge, icon).
      const exposed = link[1]
        .replace(/<(\w+)[^>]*aria-hidden="true"[^>]*>[\s\S]*?<\/\1>/g, '')
        .replace(/<[^>]+>/g, '')
        .trim();
      assert.equal(exposed, t(store, 'cart_label', lang), `${lang}/${p}: only the sr-only label should be exposed`);
      assert.match(link[1], /<span class="sr-only" data-cart-count-label data-template="[^"]*\{n\}/, `${lang}/${p}: label template must carry the count`);
    }
  }
  const src = fs.readFileSync(path.join(SRC, 'scripts/cart-count.js'), 'utf8');
  assert.doesNotMatch(src, /aria-hidden/, 'cart-count.js must not un-hide the badge');
});

test('checkout confirm: jumps to the top of the page, then focuses the confirmation heading', () => {
  const src = fs.readFileSync(path.join(SRC, 'scripts/checkout.js'), 'utf8');
  const handler = src.slice(src.indexOf("querySelector('[data-confirm]')"));
  const scroll = handler.indexOf('window.scrollTo(0, 0)');
  const focus = handler.indexOf(".querySelector('h2').focus({ preventScroll: true })");
  assert.ok(scroll > 0, 'confirm handler must scroll to the top');
  assert.ok(focus > scroll, 'focus the heading after scrolling, without a second scroll');
});

test('cart: product-name links are at least 44px tall', () => {
  const src = fs.readFileSync(path.join(SRC, 'scripts/cart-page.js'), 'utf8');
  const cls = src.match(/nameLink\.className = '([^']*)'/);
  assert.ok(cls, 'cart-page.js must set a class on the product-name link');
  const list = cls[1].split(' ');
  assert.ok(list.includes('min-h-11') && list.some((c) => /^(inline-)?(flex|block|grid)$/.test(c)), `name link needs min-h-11 on a non-inline box, got "${cls[1]}"`);
});
