import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const site = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/site.json'), 'utf8'));
const paths = ['', 'menu', 'seasonal', 'story', 'branches', ...site.categories.map((c) => `menu/${c.slug}`)];
const pages = paths.flatMap((p) => ['ar', 'en'].map((lang) => ({
  lang, p, html: fs.readFileSync(path.join(DIST, lang === 'en' ? 'en' : '', p, 'index.html'), 'utf8'),
})));
const meta = (html, prop) => (html.match(new RegExp(`<meta property="${prop}" content="([^"]*)"`)) || [])[1];
const jsonLd = (html) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));

test('seo: every page has Open Graph tags matching its title/description, and the El Abd favicon', () => {
  for (const { lang, p, html } of pages) {
    const title = html.match(/<title>([^<]*)<\/title>/)[1];
    assert.equal(meta(html, 'og:title'), title, `${lang}/${p}: og:title`);
    assert.ok(meta(html, 'og:description'), `${lang}/${p}: og:description missing`);
    assert.equal(new URL(meta(html, 'og:url')).pathname.replace(/\/$/, ''), `${lang === 'en' ? '/en' : ''}${p ? `/${p}` : ''}`, `${lang}/${p}: og:url`);
    assert.equal(meta(html, 'og:image'), site.brand.og_image, `${lang}/${p}: og:image`);
    assert.equal(meta(html, 'og:locale'), lang === 'en' ? 'en_US' : 'ar_EG', `${lang}/${p}: og:locale`);
    assert.match(html, /<link rel="icon" type="image\/png" href="\/images\/elabd-logo\.png">/, `${lang}/${p}: favicon`);
  }
  assert.ok(fs.existsSync(path.join(DIST, 'favicon.ico')), 'favicon.ico missing');
  assert.ok(!fs.existsSync(path.join(DIST, 'favicon.svg')), 'Astro template favicon.svg still shipped');
});

test('seo: home and branches carry one Organization plus one Bakery per branch; other pages carry none', () => {
  for (const { lang, p, html } of pages) {
    const blocks = jsonLd(html);
    if (p !== '' && p !== 'branches') { assert.equal(blocks.length, 0, `${lang}/${p}: unexpected JSON-LD`); continue; }
    assert.equal(blocks.length, 1, `${lang}/${p}: expected one JSON-LD block`);
    const graph = blocks[0]['@graph'];
    const orgs = graph.filter((n) => n['@type'] === 'Organization');
    const bakeries = graph.filter((n) => n['@type'] === 'Bakery');
    assert.equal(orgs.length, 1, `${lang}/${p}: Organization count`);
    assert.equal(orgs[0].name, site.brand[`name_${lang}`]);
    const branches = site[`branches_${lang}`];
    assert.equal(bakeries.length, branches.length, `${lang}/${p}: one Bakery per branch`);
    branches.forEach((b, i) => {
      assert.ok(bakeries[i].name.endsWith(b), `${lang}/${p}: Bakery ${i} is not ${b}`);
      assert.equal(bakeries[i].parentOrganization['@id'], orgs[0]['@id']);
      assert.equal(bakeries[i].telephone, site.contact.hotline);
    });
  }
});
