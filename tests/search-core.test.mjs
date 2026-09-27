import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeForSearch, matchesQuery } from '../src/lib/search-core.js';

const HAY = 'كنافة مكسرات Kunafa with Nuts';

test('matchesQuery: Arabic query against a mixed ar/en haystack', () => {
  assert.equal(matchesQuery(HAY, 'كنافه'), true);
});

test('matchesQuery: case-insensitive English tokens', () => {
  assert.equal(matchesQuery(HAY, 'KUNAFA nuts'), true);
});

test('matchesQuery: no match', () => {
  assert.equal(matchesQuery(HAY, 'basbousa'), false);
});

test('matchesQuery: empty query matches everything', () => {
  assert.equal(matchesQuery(HAY, ''), true);
});

test('matchesQuery: query of only punctuation behaves as empty', () => {
  assert.equal(matchesQuery(HAY, '!!! --- ...'), true);
});

test('matchesQuery: Arabic-Indic digits normalize to Latin', () => {
  assert.equal(matchesQuery('كحك ٣٠ قطعة', '30'), true);
});

test('matchesQuery: Latin diacritics are stripped', () => {
  assert.equal(matchesQuery('Latte Frappé', 'frappe'), true);
});

test('normalizeForSearch: hamza/alef and ta-marbuta/ya variants map to one form', () => {
  assert.equal(normalizeForSearch('أإآٱ'), 'اااا');
  assert.equal(normalizeForSearch('ة'), 'ه');
  assert.equal(normalizeForSearch('ى'), 'ي');
});

test('normalizeForSearch: tashkeel and tatweel are stripped', () => {
  assert.equal(normalizeForSearch('قطعّة'), normalizeForSearch('قطعة'));
  assert.equal(normalizeForSearch('كـــحك'), normalizeForSearch('كحك'));
});

test('normalizeForSearch: Arabic-Indic digits map to Latin', () => {
  assert.equal(normalizeForSearch('٣٠'), '30');
});

test('normalizeForSearch: leading/trailing spaces and mixed case collapse', () => {
  assert.equal(normalizeForSearch('  Mega   Croissant  '), 'mega croissant');
});
