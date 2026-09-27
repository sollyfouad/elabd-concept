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
      assert.match(hero, new RegExp(`<p aria-hidden="true" class="m-part-(start|end)[^"]*"[^>]*>${w}</p>`), `${lang}: decorative word "${w}" must be aria-hidden`);
    }
    const ribbon = hero.match(/<span class="m-ribbon-scroll[^"]*">([\s\S]*?)<\/span><\/span>/)[1];
    for (const fact of [num(site.contact.hotline, lang), num(site.branches_ar.length, lang), num(site.brand.since, lang)]) {
      assert.ok(ribbon.includes(fact), `${lang}: ribbon missing real fact ${fact}`);
    }
    const status = hero.match(/<p data-open-status[^>]*>[\s\S]*?<\/p>/)[0];
    assert.ok(status.includes(`data-hours="[${site.contact.open_hours.join(',')}]"`), `${lang}: status needs the real hours`);
    assert.ok(status.includes(site.contact[`hours_${lang}`]), `${lang}: static hours must show without JS`);
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
