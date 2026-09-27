import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CART_KEY, MAX_QTY, parseCart, serializeCart, addItem, setQty, removeItem, countItems,
  pruneUnknown, cartTotal, parseQtyInput,
} from '../src/lib/cart-core.js';

test('CART_KEY / MAX_QTY constants', () => {
  assert.equal(CART_KEY, 'elabd-cart-v1');
  assert.equal(MAX_QTY, 20);
});

test('parseCart: null, garbage, wrong v, non-array items all return []', () => {
  assert.deepEqual(parseCart(null), []);
  assert.deepEqual(parseCart('not json'), []);
  assert.deepEqual(parseCart('{"v":2,"items":[]}'), []);
  assert.deepEqual(parseCart('{"v":1,"items":"nope"}'), []);
  assert.deepEqual(parseCart('{}'), []);
});

test('parseCart: drops items with a bad slug', () => {
  assert.deepEqual(parseCart(JSON.stringify({ v: 1, items: [{ slug: '', qty: 1 }, { slug: 42, qty: 1 }, { qty: 1 }] })), []);
});

test('parseCart: clamps qty 0, -3, 25 into 1..MAX_QTY; drops qty "abc"', () => {
  const items = parseCart(JSON.stringify({
    v: 1,
    items: [
      { slug: 'a', qty: 0 },
      { slug: 'b', qty: -3 },
      { slug: 'c', qty: 25 },
      { slug: 'd', qty: 'abc' },
    ],
  }));
  assert.deepEqual(items, [
    { slug: 'a', qty: 1 },
    { slug: 'b', qty: 1 },
    { slug: 'c', qty: 20 },
  ]);
});

test('parseCart: merges duplicate slugs (sum, clamped)', () => {
  const items = parseCart(JSON.stringify({ v: 1, items: [{ slug: 'a', qty: 5 }, { slug: 'a', qty: 4 }, { slug: 'a', qty: 15 }] }));
  assert.deepEqual(items, [{ slug: 'a', qty: 20 }]);
});

test('serializeCart', () => {
  assert.equal(serializeCart([{ slug: 'a', qty: 2 }]), JSON.stringify({ v: 1, items: [{ slug: 'a', qty: 2 }] }));
});

test('addItem: appends a new line, adds to an existing one, clamps at MAX_QTY', () => {
  let items = addItem([], 'a', 1);
  assert.deepEqual(items, [{ slug: 'a', qty: 1 }]);
  items = addItem(items, 'a', 2);
  assert.deepEqual(items, [{ slug: 'a', qty: 3 }]);
  items = addItem([{ slug: 'a', qty: 18 }], 'a', 5);
  assert.deepEqual(items, [{ slug: 'a', qty: 20 }]);
});

test('setQty: clamps to 1..MAX_QTY; non-finite qty leaves items unchanged', () => {
  const base = [{ slug: 'a', qty: 5 }];
  assert.deepEqual(setQty(base, 'a', 0), [{ slug: 'a', qty: 1 }]);
  assert.deepEqual(setQty(base, 'a', 99), [{ slug: 'a', qty: 20 }]);
  assert.equal(setQty(base, 'a', NaN), base);
  assert.equal(setQty(base, 'a', Infinity), base);
});

test('removeItem', () => {
  assert.deepEqual(removeItem([{ slug: 'a', qty: 1 }, { slug: 'b', qty: 2 }], 'a'), [{ slug: 'b', qty: 2 }]);
});

test('countItems', () => {
  assert.equal(countItems([{ slug: 'a', qty: 3 }, { slug: 'b', qty: 4 }]), 7);
  assert.equal(countItems([]), 0);
});

test('pruneUnknown', () => {
  const items = [{ slug: 'a', qty: 1 }, { slug: 'b', qty: 1 }];
  assert.deepEqual(pruneUnknown(items, new Set(['a'])), [{ slug: 'a', qty: 1 }]);
});

test('cartTotal: 139.5×3 + 55 = 473.5, hasRange true when a price_to product is present', () => {
  const items = [{ slug: 'pack', qty: 3 }, { slug: 'plain', qty: 1 }];
  const catalog = { pack: { price: 139.5, price_to: 167.4 }, plain: { price: 55 } };
  const { total, hasRange } = cartTotal(items, catalog);
  assert.equal(total, 473.5);
  assert.equal(hasRange, true);
});

test('cartTotal: hasRange false with no price_to lines; unknown slugs ignored', () => {
  const items = [{ slug: 'plain', qty: 2 }, { slug: 'ghost', qty: 5 }];
  const catalog = { plain: { price: 55 } };
  const { total, hasRange } = cartTotal(items, catalog);
  assert.equal(total, 110);
  assert.equal(hasRange, false);
});

test('parseQtyInput: Arabic-Indic digits, trims, rejects non-integers', () => {
  assert.equal(parseQtyInput('١٢'), 12);
  assert.equal(parseQtyInput('  7 '), 7);
  assert.equal(parseQtyInput('1.5'), null);
  assert.equal(parseQtyInput('abc'), null);
  assert.equal(parseQtyInput(''), null);
});
