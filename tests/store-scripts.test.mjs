// Behaviour of the store's client scripts, run against the real source: range-price display in
// cart and checkout, qty input clamp/revert, cart storage fallback and cross-tab sync, checkout
// summary and empty state, add-to-cart announcements, and what ships in the client bundles.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { formatPrice, roundMoney } from '../src/lib/price-format.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const site = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/site.json'), 'utf8'));

// format.js does `import site from '../data/site.json'` with no import attribute, which plain
// `node --test` (unlike Astro/Vite) refuses to load directly. Extract categoryOf's real
// expression instead of statically importing the module, and run it against the already-parsed
// `site` object above (same technique as the price-format extraction tests below).
function loadCategoryOf() {
  const src = fs.readFileSync(path.join(SRC, 'lib/format.js'), 'utf8');
  const m = extract(src, /export const categoryOf = \(p\) => (site\.categories\.find\([^;]*\));/);
  return new Function('site', 'p', `return ${m[1]};`).bind(null, site);
}

function extract(src, re) {
  const m = src.match(re);
  assert.ok(m, `expected to find a match for ${re}`);
  return m;
}

// ============================================================
// A6 / Req 21 / Req 23: "Add to cart uses price (the lower bound)... In the cart and checkout,
// any line with price_to ... is prefixed with ui.store.from_{lang}." Req 23 spells out the exact
// formula for the total: formatPrice(total, null, lang, currency, hasRange ? from : undefined) —
// i.e. no range, lower-bound number only, "from"-prefixed. The per-line unit price and line total
// are held to the same rule (a range doesn't make sense once the add-to-cart commit already fixed
// the charged amount at the lower bound).
// ============================================================

test('A6/Req21: cart-page.js unit price for a price_to line is the lower-bound price prefixed with "from", not a price range', () => {
  const src = fs.readFileSync(path.join(SRC, 'scripts/cart-page.js'), 'utf8');
  const m = extract(src, /unitPrice\.textContent = (formatPrice\([^;]*\));/);
  const fn = new Function('p', 'item', 'lang', 'currency', 't', 'formatPrice', `return ${m[1]};`);
  const p = { price: 139.5, price_to: 167.4 };
  const t = (k) => ({ from: 'from' })[k];
  const got = fn(p, { qty: 1 }, 'en', 'EGP', t, formatPrice);
  assert.equal(got, 'from 139.5 EGP',
    `A6: the cart shows the lower-bound price ("Add to cart uses price (the lower bound)"), from-prefixed, not a range. Got ${JSON.stringify(got)}`);
});

test('A6/Req21: cart-page.js line total for a price_to line is lower-bound×qty prefixed with "from", not a price range', () => {
  const src = fs.readFileSync(path.join(SRC, 'scripts/cart-page.js'), 'utf8');
  const m = extract(src, /const amount = (roundMoney\([^;]*\));\s*const amountTo = ([^;]*);\s*lineTotal\.textContent = (formatPrice\([^;]*\));/);
  const fn = new Function('p', 'item', 'lang', 'currency', 't', 'formatPrice', 'roundMoney',
    `const amount = ${m[1]}; const amountTo = ${m[2]}; return ${m[3]};`);
  const p = { price: 139.5, price_to: 167.4 };
  const t = (k) => ({ from: 'from' })[k];
  const got = fn(p, { qty: 3 }, 'en', 'EGP', t, formatPrice, roundMoney);
  assert.equal(got, 'from 418.5 EGP',
    `A6: the line total should be lower-bound price × qty ("from 418.5 EGP"), not a range. Got ${JSON.stringify(got)}`);
});

test('A6/Req28: checkout.js summary line total for a price_to line is lower-bound×qty prefixed with "from", not a price range', () => {
  const src = fs.readFileSync(path.join(SRC, 'scripts/checkout.js'), 'utf8');
  const m = extract(src, /const amount = (roundMoney\([^;]*\));\s*const amountTo = ([^;]*);\s*lineTotal\.textContent = (formatPrice\([^;]*\));/);
  const fn = new Function('p', 'item', 'lang', 'currency', 't', 'formatPrice', 'roundMoney',
    `const amount = ${m[1]}; const amountTo = ${m[2]}; return ${m[3]};`);
  const p = { price: 139.5, price_to: 167.4 };
  const t = (k) => ({ from: 'from' })[k];
  const got = fn(p, { qty: 3 }, 'en', 'EGP', t, formatPrice, roundMoney);
  assert.equal(got, 'from 418.5 EGP',
    `A6: the checkout summary line total should be lower-bound price × qty ("from 418.5 EGP"), not a range. Got ${JSON.stringify(got)}`);
});

// ============================================================
// Edge case 6 (updated by user decision, overrides the earlier wording): a typed whole number
// outside 1..20 clamps (0 -> 1, 21+ -> 20). Typing "", 1.5 or abc (not a whole number at all)
// reverts to the previous value. This applies to the product page's qty input.
// ============================================================

function makeField(initial) {
  const handlers = {};
  return {
    value: initial,
    disabled: false,
    addEventListener(type, fn) { (handlers[type] ||= []).push(fn); },
    fire(type) { (handlers[type] || []).forEach((fn) => fn()); },
  };
}

test('Edge case 6: product-page.js qty input clamps 0/21 and reverts on "", 1.5, abc', async () => {
  const qtyEl = makeField('1');
  const decEl = makeField();
  const incEl = makeField();
  global.document = {
    documentElement: { lang: 'en' },
    getElementById(id) { return id === 'qty' ? qtyEl : null; },
    querySelector(sel) {
      if (sel === '[data-qty-dec]') return decEl;
      if (sel === '[data-qty-inc]') return incEl;
      return null;
    },
    querySelectorAll() { return []; },
  };
  try {
    const modUrl = `${pathToFileURL(path.join(SRC, 'scripts/product-page.js')).href}?t=${Date.now()}-${Math.random()}`;
    await import(modUrl);

    qtyEl.value = '5';
    qtyEl.fire('change');
    assert.equal(qtyEl.value, '5', 'seed: typing a valid 5 should set the value to 5');

    qtyEl.value = '21';
    qtyEl.fire('change');
    assert.equal(qtyEl.value, '20', 'typing 21 (a whole number above MAX_QTY) must clamp to 20, per the user-decision update to edge case 6');

    qtyEl.value = '0';
    qtyEl.fire('change');
    assert.equal(qtyEl.value, '1', 'typing 0 (a whole number below 1) must clamp to 1, per the user-decision update to edge case 6');

    for (const bad of ['', '1.5', 'abc']) {
      qtyEl.value = bad;
      qtyEl.fire('change');
      assert.equal(qtyEl.value, '1', `typing "${bad}" (not a whole number) must revert to the previous value (1), got "${qtyEl.value}"`);
    }
  } finally {
    delete global.document;
  }
});

test('product-page.js shows the quantity in Arabic-Indic digits on Arabic pages', async () => {
  const qtyEl = makeField('١');
  const incEl = makeField();
  global.document = {
    documentElement: { lang: 'ar' },
    getElementById(id) { return id === 'qty' ? qtyEl : null; },
    querySelector(sel) { return sel === '[data-qty-inc]' ? incEl : sel === '[data-qty-dec]' ? makeField() : null; },
    querySelectorAll() { return []; },
  };
  try {
    await import(`${pathToFileURL(path.join(SRC, 'scripts/product-page.js')).href}?t=${Date.now()}-${Math.random()}`);
    incEl.fire('click');
    assert.equal(qtyEl.value, '٢');
    qtyEl.value = '15';
    qtyEl.fire('change');
    assert.equal(qtyEl.value, '١٥', 'a typed Latin number is shown back in Arabic-Indic digits');
  } finally {
    delete global.document;
  }
});

// ============================================================
// Edge case 2: localStorage unavailable/throwing -> the cart still works for the page lifetime
// via an in-memory fallback, no uncaught error.
// ============================================================

test('Edge case 2: cart-store.js falls back to an in-memory cart when localStorage throws', async () => {
  global.window = { dispatchEvent() {}, addEventListener() {} };
  global.CustomEvent = class CustomEvent {
    constructor(type, opts) { this.type = type; this.detail = opts && opts.detail; }
  };
  global.localStorage = {
    getItem() { throw new Error('SecurityError: localStorage disabled'); },
    setItem() { throw new Error('SecurityError: localStorage disabled'); },
  };
  try {
    const modUrl = `${pathToFileURL(path.join(SRC, 'lib/cart-store.js')).href}?t=${Date.now()}-${Math.random()}`;
    const { loadCart, saveCart } = await import(modUrl);
    assert.doesNotThrow(() => saveCart([{ slug: 'foo', qty: 2 }]));
    const items = loadCart();
    assert.deepEqual(items, [{ slug: 'foo', qty: 2 }], 'the cart should read back from the in-memory fallback');
  } finally {
    delete global.window;
    delete global.CustomEvent;
    delete global.localStorage;
  }
});

// ============================================================
// Edge case 8: concurrent tabs -> a `storage` event for CART_KEY updates listeners (onCartChange).
// ============================================================

test('Edge case 8: onCartChange re-reads the cart and notifies on a cross-tab storage event for CART_KEY', async () => {
  const handlers = {};
  global.window = {
    addEventListener(type, fn) { (handlers[type] ||= []).push(fn); },
    dispatchEvent() {},
  };
  global.CustomEvent = class CustomEvent {
    constructor(type, opts) { this.type = type; this.detail = opts && opts.detail; }
  };
  let stored = null;
  global.localStorage = {
    getItem() { return stored; },
    setItem(_k, v) { stored = v; },
  };
  try {
    const modUrl = `${pathToFileURL(path.join(SRC, 'lib/cart-store.js')).href}?t=${Date.now()}-${Math.random()}`;
    const { onCartChange } = await import(modUrl);
    let received = null;
    onCartChange((items) => { received = items; });
    stored = JSON.stringify({ v: 1, items: [{ slug: 'bar', qty: 3 }] });
    assert.ok(handlers.storage && handlers.storage.length > 0, 'expected a storage listener to be registered');
    handlers.storage.forEach((fn) => fn({ key: 'elabd-cart-v1' }));
    assert.deepEqual(received, [{ slug: 'bar', qty: 3 }], 'other tab\'s change should be picked up via the storage event');

    // Unrelated storage keys must not trigger a callback with unrelated data.
    received = null;
    handlers.storage.forEach((fn) => fn({ key: 'some-other-key' }));
    assert.equal(received, null, 'a storage event for a different key must be ignored');
  } finally {
    delete global.window;
    delete global.CustomEvent;
    delete global.localStorage;
  }
});

// ============================================================
// Edge case 12: seasonal products have no category; categoryOf must return undefined, not throw.
// ============================================================

test('Edge case 12: categoryOf(seasonalProduct) returns undefined without throwing', () => {
  const categoryOf = loadCategoryOf();
  const season = site.seasonal[site.seasonal.active];
  assert.ok(season.products.length > 0, 'expected at least one seasonal product to test against');
  for (const p of season.products) {
    let result;
    assert.doesNotThrow(() => { result = categoryOf(p); }, `categoryOf threw for seasonal product ${p.ar}`);
    assert.equal(result, undefined, `categoryOf(${p.slug}) should be undefined for a seasonal product`);
  }
});

// ============================================================
// Checks not covered by store.test.mjs:
//   - noscript hotline links use num(contact.hotline, lang) (Arabic-Indic digits on ar
//     pages), not the raw Latin site.json value, on /cart and /checkout.
//   - cart-page.js/checkout.js/search.js no longer import site.json, so the client
//     bundle must not leak any product description/source_url text or the elabdfoods.com domain.
//   - checkout.js's step-3 summary must read "<method label>: <detail>", not just the
//     bare detail (A5's "shows the method, then either ... or the chosen branch name").
// These require `dist/` and `dist/_astro/` to exist, i.e. `astro build` (part of `npm test`) to
// have already run.
// ============================================================
const DIST = path.join(ROOT, 'dist');

function noscriptTelText(file) {
  const html = fs.readFileSync(file, 'utf8');
  const noscript = html.match(/<noscript>([\s\S]*?)<\/noscript>/);
  assert.ok(noscript, `${file}: no <noscript> block found`);
  const a = noscript[1].match(/<a href="tel:[^"]*"[^>]*>([\s\S]*?)<\/a>/);
  assert.ok(a, `${file}: no tel: link inside <noscript>`);
  return a[1];
}

test('/cart and /checkout noscript hotline link shows page-language digits (num(), not the raw Latin site.json value)', () => {
  assert.ok(fs.existsSync(DIST), 'expected dist/ to exist (astro build should run before tests)');
  const hotlineAr = Number(site.contact.hotline).toLocaleString('ar-EG', { useGrouping: false });
  const hotlineEn = Number(site.contact.hotline).toLocaleString('en-US', { useGrouping: false });
  assert.equal(noscriptTelText(path.join(DIST, 'cart/index.html')), hotlineAr, 'ar /cart noscript hotline should use Arabic-Indic digits');
  assert.equal(noscriptTelText(path.join(DIST, 'en/cart/index.html')), hotlineEn, 'en /cart noscript hotline should use Latin digits');
  assert.equal(noscriptTelText(path.join(DIST, 'checkout/index.html')), hotlineAr, 'ar /checkout noscript hotline should use Arabic-Indic digits');
  assert.equal(noscriptTelText(path.join(DIST, 'en/checkout/index.html')), hotlineEn, 'en /checkout noscript hotline should use Latin digits');
});

test('no built client JS bundle leaks product descriptions, source_url or the elabdfoods.com domain', () => {
  const astroDir = path.join(DIST, '_astro');
  assert.ok(fs.existsSync(astroDir), 'expected dist/_astro to exist');
  const season = site.seasonal[site.seasonal.active];
  const storeProducts = [...site.best_sellers, ...site.new_products, ...site.catalog, ...season.products];
  const jsFiles = fs.readdirSync(astroDir).filter((f) => f.endsWith('.js'));
  assert.ok(jsFiles.length > 0, 'expected at least one built JS bundle');
  for (const f of jsFiles) {
    const content = fs.readFileSync(path.join(astroDir, f), 'utf8');
    assert.doesNotMatch(content, /elabdfoods\.com/, `${f}: leaks the elabdfoods.com domain (source_url/gallery/img host)`);
    for (const p of storeProducts) {
      if (p.desc_en) assert.ok(!content.includes(p.desc_en.slice(0, 24)), `${f}: leaks desc_en text for ${p.slug}`);
      if (p.desc_ar) assert.ok(!content.includes(p.desc_ar.slice(0, 12)), `${f}: leaks desc_ar text for ${p.slug}`);
    }
  }
});

// ============================================================
// Edge case 7: adding past the per-line limit (e.g. adding 5 to an existing line of 18) still
// clamps the line to MAX_QTY (already covered in cart-core.test.mjs) AND the status message
// still announces the add (cart-ui.js must not skip the announcement just because the qty was
// clamped rather than applied in full).
// ============================================================
function makeEl(attrs = {}) {
  const handlers = {};
  return {
    ...attrs,
    getAttribute(name) { return attrs[name] ?? null; },
    addEventListener(type, fn) { (handlers[type] ||= []).push(fn); },
    click() { (handlers.click || []).forEach((fn) => fn()); },
    querySelector(sel) { return (attrs.children || {})[sel] ?? null; },
    dataset: {},
  };
}

test('Edge case 7: cart-ui.js still announces the add via #cart-status when the qty was clamped at MAX_QTY', async () => {
  let stored = JSON.stringify({ v: 1, items: [{ slug: 'happiness-value-pack-6-gateaux', qty: 18 }] });
  global.localStorage = {
    getItem() { return stored; },
    setItem(_k, v) { stored = v; },
  };
  global.window = { dispatchEvent() {}, addEventListener() {} };
  global.CustomEvent = class CustomEvent {
    constructor(type, opts) { this.type = type; this.detail = opts && opts.detail; }
  };
  const statusEl = makeEl({ textContent: '' });
  const qtyInput = makeEl({ value: '5' });
  const labelEl = { textContent: 'Add to cart', appendChild(child) { this.textContent += child.textContent; } };
  const button = makeEl({ 'data-add-to-cart': 'happiness-value-pack-6-gateaux', 'data-qty-input': 'qty', 'data-added-template': 'Added to cart: {name}', 'data-name': 'Happiness Value Pack', 'data-added-label': 'Added', children: { '[data-btn-label]': labelEl } });
  global.document = {
    documentElement: { lang: 'en' },
    createElement() { return { textContent: '', setAttribute() {} }; },
    getElementById(id) {
      if (id === 'cart-status') return statusEl;
      if (id === 'qty') return qtyInput;
      return null;
    },
    querySelectorAll(sel) { return sel === 'button[data-add-to-cart]' ? [button] : []; },
  };
  try {
    const modUrl = `${pathToFileURL(path.join(SRC, 'scripts/cart-ui.js')).href}?t=${Date.now()}-${Math.random()}`;
    await import(modUrl);
    button.click();
    const items = JSON.parse(stored).items;
    assert.equal(items[0].qty, 20, 'the line should clamp to MAX_QTY (18 + 5 = 23 -> 20)');
    assert.equal(statusEl.textContent, 'Added to cart: Happiness Value Pack',
      'the status message must still announce the add even though the qty was clamped, not skipped');
    assert.equal(labelEl.textContent, 'Added ✓', 'the button shows the visible "Added ✓" state after adding');
  } finally {
    delete global.localStorage;
    delete global.window;
    delete global.CustomEvent;
    delete global.document;
  }
});

// ============================================================
// Edge case 9: visiting /checkout directly with an empty cart never shows a summary -
// checkout.js's own top-level branch (not just the static markup store.test.mjs checks) must
// hide the step sections and show [data-checkout-empty] when the (catalog-filtered) cart is empty.
// ============================================================
test('Edge case 9: checkout.js hides the step sections and shows the empty state when the cart is empty', async () => {
  global.localStorage = { getItem() { return null; }, setItem() {} };
  const emptyEl = makeEl({ hidden: true });
  const stepsOl = makeEl({ hidden: false });
  const sections = [makeEl({ hidden: false, dataset: { step: '1' } }), makeEl({ hidden: false, dataset: { step: '2' } }), makeEl({ hidden: false, dataset: { step: '3' } })];
  global.document = {
    documentElement: { lang: 'en' },
    getElementById() { return null; },
    querySelector(sel) {
      if (sel === '[data-checkout-empty]') return emptyEl;
      if (sel === 'ol[aria-label]') return stepsOl;
      return null;
    },
    querySelectorAll(sel) {
      if (sel === '[data-step-section]') return sections;
      return [];
    },
  };
  try {
    const modUrl = `${pathToFileURL(path.join(SRC, 'scripts/checkout.js')).href}?t=${Date.now()}-${Math.random()}`;
    await import(modUrl);
    assert.equal(emptyEl.hidden, false, 'expected [data-checkout-empty] to be shown for an empty cart');
    assert.equal(stepsOl.hidden, true, 'expected the step indicator <ol> to be hidden for an empty cart');
    for (const s of sections) assert.equal(s.hidden, true, 'expected every step section to be hidden for an empty cart');
  } finally {
    delete global.localStorage;
    delete global.document;
  }
});
