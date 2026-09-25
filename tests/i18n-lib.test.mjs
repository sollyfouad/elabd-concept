import test from 'node:test';
import assert from 'node:assert/strict';
import { stripLocale, localizeHref, alternates } from '../src/lib/i18n.js';

test('stripLocale', () => {
  assert.equal(stripLocale('/en'), '/');
  assert.equal(stripLocale('/en/'), '/');
  assert.equal(stripLocale('/en/menu/'), '/menu');
  assert.equal(stripLocale('/enquiries'), '/enquiries');
  assert.equal(stripLocale('/'), '/');
});

test('localizeHref', () => {
  assert.equal(localizeHref('/', 'en'), '/en/');
  assert.equal(localizeHref('/menu/bakery', 'en'), '/en/menu/bakery');
  assert.equal(localizeHref('#bakery', 'en'), '#bakery');
  assert.equal(localizeHref('tel:17111', 'en'), 'tel:17111');
  assert.equal(localizeHref('/menu', 'ar'), '/menu');
});

test('alternates', () => {
  assert.deepEqual(alternates('/en/story/'), { ar: '/story', en: '/en/story' });
  assert.deepEqual(alternates('/'), { ar: '/', en: '/en/' });
});
