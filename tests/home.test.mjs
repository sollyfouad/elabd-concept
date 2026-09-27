import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isOpenInCairo, cairoClock } from '../src/lib/open-hours.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const site = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/site.json'), 'utf8'));
const home = (lang) => fs.readFileSync(path.join(DIST, lang === 'en' ? 'en' : '', 'index.html'), 'utf8');
const arDigits = (n) => Number(n).toLocaleString('ar-EG', { useGrouping: false });
const num = (n, lang) => (lang === 'en' ? String(n) : arDigits(n));

test('isOpenInCairo follows the real 9 AM to midnight hours in Cairo time', () => {
  const hours = site.contact.open_hours;
  assert.deepEqual(hours, [9, 24]);
  // January: Cairo is UTC+2.
  assert.equal(isOpenInCairo(new Date('2026-01-15T06:59:00Z'), hours), false, '08:59 Cairo');
  assert.equal(isOpenInCairo(new Date('2026-01-15T07:00:00Z'), hours), true, '09:00 Cairo');
  assert.equal(isOpenInCairo(new Date('2026-01-15T21:59:00Z'), hours), true, '23:59 Cairo');
  assert.equal(isOpenInCairo(new Date('2026-01-15T22:00:00Z'), hours), false, '00:00 Cairo');
  assert.match(cairoClock(new Date('2026-01-15T07:05:00Z'), 'en'), /^9:05\sAM$/);
  assert.match(cairoClock(new Date('2026-01-15T07:05:00Z'), 'ar'), /^٩:٠٥/);
});

test('home hero: split tagline around the real box, real facts on the ribbon, live status with static fallback', () => {
  for (const lang of ['ar', 'en']) {
    const html = home(lang);
    const hero = html.match(/<section data-hero[\s\S]*?<\/section>/)[0];
    const [w1, w2] = site.ui.home[`wordmark_${lang}`];
    assert.equal(`${w1} ${w2}`, site.brand[`tagline_${lang}`], `${lang}: wordmark must be the real tagline`);
    for (const w of [w1, w2]) {
      assert.match(hero, new RegExp(`<span class="m-part-(start|end)[^"]*"[^>]*>${w}\\s*</span>`), `${lang}: tagline word "${w}" missing`);
    }
    // The tagline and box are one link to the Mouled collection, named by its own content (no aria-label,
    // so what screen readers hear always matches what's on screen): the two words, then a hidden destination.
    const link = hero.match(/<a href="([^"]*)"(?: [^>]*)?>((?:(?!<\/a>)[\s\S])*m-part-start(?:(?!<\/a>)[\s\S])*m-part-end[\s\S]*?)<\/a>/);
    assert.ok(link, `${lang}: tagline must be a single link wrapping both words`);
    assert.equal(link[1], lang === 'en' ? '/en/seasonal' : '/seasonal', `${lang}: tagline link target`);
    assert.doesNotMatch(link[0].match(/<a[^>]*>/)[0], /aria-label/, `${lang}: link is named by its content, not aria-label`);
    const words = [...link[2].matchAll(/<span class="m-part-(?:start|end)[^"]*"[^>]*>([^<]*)<\/span>/g)].map((m) => m[1].trim());
    assert.equal(words.join(' '), site.brand[`tagline_${lang}`], `${lang}: visible words`);
    assert.ok(link[2].includes(`<span class="sr-only">: ${site.ui.home[`seasonal_cta_${lang}`]}</span>`), `${lang}: hidden destination text`);
    assert.match(link[2], /<img[^>]*alt=""/, `${lang}: the photo inside the named link is decorative`);
    const ribbon = hero.match(/<span class="m-ribbon-scroll[^"]*">([\s\S]*?)<\/span><\/span>/)[1];
    for (const fact of [num(site.contact.hotline, lang), num(site.branches_ar.length, lang), num(site.brand.since, lang)]) {
      assert.ok(ribbon.includes(fact), `${lang}: ribbon missing real fact ${fact}`);
    }
    const photo = hero.match(/<img[^>]*data-hero-photo[^>]*>/)[0];
    assert.doesNotMatch(photo, /mix-blend/, `${lang}: the white-background photo must not be multiplied into the pink`);
    assert.match(photo, /\bbg-white\b/, `${lang}: the photo sits on a white plate`);
    const status = hero.match(/<p data-open-status[^>]*>[\s\S]*?<\/p>/)[0];
    assert.match(status, /class="[^"]*\bwhitespace-nowrap\b/, `${lang}: the hours badge stays on one line`);
    assert.ok(status.includes(`data-hours="[${site.contact.open_hours.join(',')}]"`), `${lang}: status needs the real hours`);
    const fallback = site.ui.home[`order_hours_${lang}`].replace('{hours}', site.contact[`hours_${lang}`]);
    assert.ok(status.includes(fallback), `${lang}: without JS the badge shows the hours, labelled as hotline/order hours`);
    for (const key of ['open_now', 'closed_now', 'order_hours']) {
      assert.match(site.ui.home[`${key}_${lang}`], lang === 'en' ? /Hotline and orders/ : /الخط الساخن والطلبات/, `${lang}: ${key} must name the hotline/orders, not the shop`);
    }
  }
});

test('home heritage lists every real story year, and the page ends on the hotline', () => {
  for (const lang of ['ar', 'en']) {
    const html = home(lang);
    const list = html.match(/<ol class="mt-8[^"]*">([\s\S]*?)<\/ol>/)[1];
    for (const e of site.story) {
      assert.ok(list.includes(num(e.year, lang)) && list.includes(e[lang]), `${lang}: story line ${e.year} missing`);
    }
    const main = html.match(/<main[\s\S]*<\/main>/)[0];
    const lastSection = main.slice(main.lastIndexOf('<section'));
    assert.match(lastSection, new RegExp(`<a href="tel:${site.contact.hotline}"[^>]*>${num(site.contact.hotline, lang)}</a>`), `${lang}: closing hotline link`);
    assert.match(lastSection, /<a href="tel:[^"]*" class="[^"]*\bmin-h-11\b/, `${lang}: closing link needs a 44px target`);
  }
});

test('open-status script ships on the home pages only', () => {
  const marker = 'data-open-status';
  const scriptsOf = (html) => [...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map((m) => fs.readFileSync(path.join(DIST, m[1]), 'utf8')).join('\n')
    + [...html.matchAll(/<script(?![^>]*(?:src=|application\/(?:ld\+)?json))[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n');
  for (const lang of ['ar', 'en']) {
    assert.ok(scriptsOf(home(lang)).includes(marker), `${lang}: home is missing the open-status script`);
    const story = fs.readFileSync(path.join(DIST, lang === 'en' ? 'en' : '', 'story', 'index.html'), 'utf8');
    assert.ok(!scriptsOf(story).includes(marker), `${lang}: open-status script leaked onto /story`);
  }
});

test('home hero states the real lowest Mouled box price upfront', () => {
  const season = site.seasonal[site.seasonal.active];
  const lowest = Math.min(...season.products.filter((p) => p.pieces).map((p) => p.price));
  assert.equal(lowest, 570, 'data check: Mouled Box 4 is the cheapest box');
  for (const lang of ['ar', 'en']) {
    const hero = home(lang).match(/<section data-hero[\s\S]*?<\/section>/)[0];
    const priceText = `${num(lowest, lang)} ${site[`currency_${lang}`]}`;
    const expected = site.ui.home[`boxes_from_${lang}`].replace('{price}', priceText);
    assert.ok(hero.includes(expected), `${lang}: hero should say "${expected}"`);
    // It sits right under the box link, before the h1.
    assert.ok(hero.indexOf(expected) > hero.indexOf('m-part-end') && hero.indexOf(expected) < hero.indexOf('<h1'), `${lang}: price belongs next to the box`);
  }
});
