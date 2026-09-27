import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const SRC = path.join(ROOT, 'src');

const site = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/site.json'), 'utf8'));

const categorySlugs = site.categories.map((c) => c.slug);
const season = site.seasonal[site.seasonal.active];
const storeProductsList = [...site.best_sellers, ...site.new_products, ...site.catalog, ...season.products];
const paths = ['', 'menu', 'seasonal', 'story', 'branches', 'cart', 'checkout', 'search', ...categorySlugs.map((s) => `menu/${s}`), ...storeProductsList.map((p) => `products/${p.slug}`)];

function distFile(p) {
  return path.join(DIST, p, 'index.html');
}
function distFileEn(p) {
  return path.join(DIST, 'en', p, 'index.html');
}
function readPage(p) {
  return fs.readFileSync(distFile(p), 'utf8');
}
function readPageEn(p) {
  return fs.readFileSync(distFileEn(p), 'utf8');
}
function allPages() {
  const out = [];
  for (const p of paths) {
    out.push({ p, lang: 'ar', html: readPage(p) });
    out.push({ p, lang: 'en', html: readPageEn(p) });
  }
  return out;
}
function walkFiles(dir, exts) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(full, exts));
    else if (exts.some((e) => entry.name.endsWith(e))) out.push(full);
  }
  return out;
}
function escapeRe(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function count(str, sub) {
  return str.split(sub).length - 1;
}

// ---- T1: the 3D hero is gone: no three dependency, no hero scripts, no three imports ----
test('T1: three.js and the hero scripts are removed entirely', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.equal(pkg.dependencies?.three, undefined, 'three is still a dependency');
  assert.equal(pkg.devDependencies?.three, undefined, 'three is still a devDependency');
  assert.ok(!fs.existsSync(path.join(SRC, 'scripts/hero')), 'src/scripts/hero still exists');
  const importers = walkFiles(SRC, ['.js', '.astro', '.mjs']).filter((f) => /from ['"]three['"]|import\(['"]three/.test(fs.readFileSync(f, 'utf8')));
  assert.deepEqual(importers, [], 'files still import three');
});

// ---- T2: no canvas mount, lid button or 3D data attributes on any page ----
test('T2: no page carries a canvas, hero mount, lid button or texture attributes', () => {
  for (const { p, lang, html } of allPages()) {
    for (const re of [/<canvas/, /data-hero-canvas/, /data-lid-toggle/, /data-product-img/, /data-hero-fallback/]) {
      assert.doesNotMatch(html, re, `${re} found on ${lang}/${p}`);
    }
  }
});

// ---- T3: photo hero: the hero_photo Mouled box, sized up front (no layout shift), with h1 and CTAs ----
test('T3: home hero shows the hero_photo box image with fixed dimensions, plus the h1, intro and both CTAs', () => {
  const season = site.seasonal[site.seasonal.active];
  const heroes = season.products.filter((p) => p.hero_photo);
  assert.equal(heroes.length, 1, 'exactly one seasonal product must have hero_photo: true');
  const hero = heroes[0];
  assert.match(hero.ar, /علبة/, 'hero_photo should be a Mouled box');
  for (const [html, lang] of [[readPage(''), 'ar'], [readPageEn(''), 'en']]) {
    const section = html.slice(html.indexOf('data-hero'), html.indexOf('</section>', html.indexOf('data-hero')));
    const imgs = [...section.matchAll(/<img[^>]*data-hero-photo[^>]*>/g)].map((m) => m[0]);
    assert.equal(imgs.length, 1, `expected one hero photo (${lang})`);
    const img = imgs[0];
    assert.ok(img.includes(`src="${hero.img}"`), `hero photo src mismatch (${lang})`);
    // Decorative inside the tagline link (the link's aria-label names it), so alt is empty.
    assert.ok(img.includes('alt=""'), `hero photo should be alt="" inside the named link (${lang})`);
    assert.ok(img.includes(`${hero.img_large} 810w`), `hero photo srcset lacks the 810w original (${lang})`);
    // The 810px original is only 2x-sharp up to 405 CSS px, so no size in `sizes` may exceed that.
    const sizesPx = [...img.match(/sizes="([^"]*)"/)[1].matchAll(/\)\s*(\d+)px|^(\d+)px|,\s*(\d+)px/g)].map((m) => Number(m[1] || m[2] || m[3]));
    assert.ok(sizesPx.length && Math.max(...sizesPx) <= 405, `hero photo sizes should cap at 405px (${lang}), got ${sizesPx}`);
    assert.match(img, /width="\d+"/, `hero photo needs width (${lang})`);
    assert.match(img, /height="\d+"/, `hero photo needs height (${lang})`);
    assert.doesNotMatch(img, /loading="lazy"/, `hero photo must not lazy-load (${lang})`);
    assert.match(img, /fetchpriority="high"/, `hero photo should have fetchpriority=high (${lang})`);
    assert.match(section, new RegExp(`<h1[^>]*>${escapeRe(site.brand[`hero_${lang}`])}</h1>`), `h1 mismatch (${lang})`);
    assert.ok(section.includes(site.ui.home[`intro_${lang}`]), `intro missing (${lang})`);
    assert.ok(section.includes('href="tel:17111"'), `hotline CTA missing (${lang})`);
    assert.ok(section.includes(`href="${lang === 'en' ? '/en/menu' : '/menu'}"`), `menu CTA missing (${lang})`);
  }
});

// ---- T5 (Req 30): cart-count.js now loads on every page, so every page carries a <script> ----
test('T5: every page carries at least one executable <script> (cart-count.js loads everywhere)', () => {
  for (const { p, lang, html } of allPages()) {
    // JSON-LD and the embedded catalog are data, not JavaScript; only executable scripts count.
    const has = /<script(?![^>]*type="application\/(?:ld\+json|json)")/.test(html);
    assert.ok(has, `expected a <script> on ${lang}/${p}`);
  }
});

// ---- T6: no three.js code ships in any built file ----
test('T6: WebGLRenderer appears in no built HTML or JS', () => {
  for (const f of walkFiles(DIST, ['.html', '.js'])) {
    assert.doesNotMatch(fs.readFileSync(f, 'utf8'), /WebGLRenderer/, `three.js code shipped in ${path.relative(DIST, f)}`);
  }
});

// ---- T7 (Req 8): every @keyframes K has .m-K in the reduced-motion block; no stray keyframes/animate- ----
test('T7: motion.css keyframes convention and reduced-motion overrides; no keyframes/animate- elsewhere', () => {
  const motionCssRaw = fs.readFileSync(path.join(SRC, 'styles/motion.css'), 'utf8');
  const motionCss = motionCssRaw.replace(/\/\*[\s\S]*?\*\//g, '');
  const mediaMatch = motionCss.match(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*)\}\s*$/);
  assert.ok(mediaMatch, 'expected a single trailing @media (prefers-reduced-motion: reduce) block');
  const mediaBlock = mediaMatch[1];

  const keyframeNames = [...motionCss.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1]);
  assert.ok(keyframeNames.length > 0, 'expected at least one @keyframes rule');
  for (const name of keyframeNames) {
    assert.match(motionCss, new RegExp(`\\.m-${name}\\s*\\{`), `no .m-${name} class defined for @keyframes ${name}`);
    assert.match(mediaBlock, new RegExp(`\\.m-${name}\\b`), `.m-${name} missing from the reduced-motion block`);
  }

  const otherFiles = walkFiles(SRC, ['.css', '.astro', '.js']).filter((f) => !f.endsWith(path.join('styles', 'motion.css')));
  for (const f of otherFiles) {
    const content = fs.readFileSync(f, 'utf8');
    assert.doesNotMatch(content, /@keyframes/, `unexpected @keyframes in ${f}`);
    assert.doesNotMatch(content, /\banimate-[\w-]+/, `unexpected Tailwind animate- class in ${f}`);
  }

  const timelineSrc = fs.readFileSync(path.join(SRC, 'scripts/story-timeline.js'), 'utf8');
  assert.match(timelineSrc, /prefers-reduced-motion/);
});

// ---- T8 (Req 9, 10, 11, 12): float sweets, coffee steam, shelf marquee, story timeline dots ----
test('T8: m-float on the 3 float sweets, m-steam in the coffee tile, shelf marquee markup, timeline dot count', () => {
  for (const [html, lang] of [[readPage(''), 'ar'], [readPageEn(''), 'en']]) {
    assert.equal(count(html, 'm-float'), 3, `expected exactly 3 m-float on home (${lang})`);
    assert.equal(count(html, 'm-steam'), 3, `expected exactly 3 m-steam on home (${lang})`);

    const coffeeIdx = html.indexOf('menu/coffee');
    assert.ok(coffeeIdx !== -1, `no menu/coffee link on home (${lang})`);
    const anchorStart = html.lastIndexOf('<a ', coffeeIdx);
    const anchorEnd = html.indexOf('</a>', coffeeIdx);
    const anchor = html.slice(anchorStart, anchorEnd);
    assert.equal(count(anchor, 'm-steam'), 3, `expected the 3 m-steam spans inside the coffee anchor (${lang})`);

    assert.match(html, /data-shelf/);
    assert.match(html, /m-marquee/);
    const copyLists = [...html.matchAll(/<ul[^>]*data-marquee-copy[^>]*>/g)];
    assert.equal(copyLists.length, 1, `expected exactly one data-marquee-copy <ul> (${lang})`);
    assert.match(copyLists[0][0], /aria-hidden="true"/);
    assert.match(copyLists[0][0], /\binert\b/);
  }

  for (const p of ['story']) {
    const dotCount = site.story.length;
    for (const html of [readPage(p), readPageEn(p)]) {
      assert.match(html, /<ol[^>]*data-timeline[^>]*>/);
      const dotTags = [...html.matchAll(/<span[^>]*\bdata-timeline-dot\b[^>]*>/g)];
      assert.equal(dotTags.length, dotCount, `expected ${dotCount} data-timeline-dot spans`);
    }
  }
});
// ---- T10 (Req 6): the home script wires shelf-touch; the story script wires the timeline ----
function resolvedScriptText(html) {
  const inline = [...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const srcs = [...html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map((m) => m[1]);
  const external = srcs.map((s) => fs.readFileSync(path.join(DIST, s.replace(/^\//, '')), 'utf8'));
  return [...inline, ...external].join('\n');
}

test('T10: home <script> contains shelf-touch signatures; story <script> contains timeline signatures', () => {
  for (const html of [readPage(''), readPageEn('')]) {
    const text = resolvedScriptText(html);
    assert.match(text, /data-shelf/, 'home script missing shelf-touch selector');
    assert.match(text, /touchstart/, 'home script missing touchstart wiring');
  }

  for (const html of [readPage('story'), readPageEn('story')]) {
    const text = resolvedScriptText(html);
    assert.match(text, /data-timeline/, 'story script missing timeline selector');
    assert.match(text, /data-timeline-dot/, 'story script missing dot selector');
  }
});

// ---- T11 (Req 8, edge cases 1/13/14): reduced-motion block sets the exact spec'd final state per animation ----
test('T11: prefers-reduced-motion block sets the exact final-state declarations from the spec', () => {
  const css = fs.readFileSync(path.join(SRC, 'styles/motion.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const mediaMatch = css.match(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*)\}\s*$/);
  assert.ok(mediaMatch, 'expected a trailing @media (prefers-reduced-motion: reduce) block');
  const block = mediaMatch[1];

  function ruleBody(selector) {
    const re = new RegExp(`${escapeRe(selector)}\\s*\\{([^}]*)\\}`);
    const m = block.match(re);
    assert.ok(m, `no rule for ${selector} in the reduced-motion block`);
    return m[1];
  }

  assert.match(ruleBody('.m-ribbon-draw'), /animation:\s*none/);
  assert.match(ruleBody('.m-ribbon-draw'), /clip-path:\s*none/);
  assert.match(ruleBody('.m-knot-settle'), /animation:\s*none/);
  assert.match(ruleBody('.m-knot-settle'), /transform:\s*none/);
  assert.match(ruleBody('.m-knot-settle'), /opacity:\s*1\b/);
  assert.match(ruleBody('.m-float'), /animation:\s*none/);
  assert.match(ruleBody('.m-float'), /transform:\s*none/);
  assert.match(ruleBody('.m-steam'), /animation:\s*none/);
  assert.match(ruleBody('.m-steam'), /display:\s*none/);
  assert.match(ruleBody('.m-marquee'), /animation:\s*none/);
  assert.match(ruleBody('.m-marquee'), /transform:\s*none/);
  assert.match(ruleBody('[data-marquee-copy]'), /display:\s*none/, 'duplicate shelf list must be hidden under reduced motion');
  assert.match(ruleBody('[data-timeline]'), /--progress:\s*1\s*!important/);

  const dotBody = ruleBody('[data-timeline-dot]');
  assert.match(dotBody, /scale\(1\)/, 'dots should be shown active (scale(1)) under reduced motion');
});

// ---- T12 (edge case 11): --ribbon-from / --marquee-dir default for LTR, flip under [dir=rtl] ----
test('T12: --ribbon-from and --marquee-dir are set for LTR by default and flipped under [dir=rtl]', () => {
  const css = fs.readFileSync(path.join(SRC, 'styles/motion.css'), 'utf8');
  const rootMatch = css.match(/:root\s*\{([^}]*)\}/);
  assert.ok(rootMatch, 'expected a :root block setting the default custom properties');
  assert.match(rootMatch[1], /--ribbon-from:\s*inset\(0 100% 0 0\)/);
  assert.match(rootMatch[1], /--marquee-dir:\s*1\b/);

  const rtlMatch = css.match(/\[dir=rtl\]\s*\{([^}]*)\}/);
  assert.ok(rtlMatch, 'expected a [dir=rtl] block flipping the custom properties');
  assert.match(rtlMatch[1], /--ribbon-from:\s*inset\(0 0 0 100%\)/);
  assert.match(rtlMatch[1], /--marquee-dir:\s*-1\b/);
});

// ---- T13 (edge case 16): HomeView must fail loudly, not render undefined, if no product has hero_box ----
// ---- T14 (rework issue 1 regression): the attribute scene.js sets must match the CSS selector ----
// ---- T15 (rework issue 2 regression): the hero text container must not eat pointer events over the 3D mount ----
// ---- T16 (rework issue 3 regression): visibilitychange must resume the render loop, not just pause it ----
// ---- T17 (rework issue 4 regression): the timeline must not derive a dot's position from dot.offsetTop alone ----
test('T17 (issue 4 regression): story-timeline computes dot position against the <ol> rect, not dot.offsetTop', () => {
  const src = fs.readFileSync(path.join(SRC, 'scripts/story-timeline.js'), 'utf8');
  // dot.offsetTop is relative to the dot's offsetParent (the <li>), not the <ol> whose rect drives --progress,
  // so every dot would report ~the same small offset regardless of its position in the list.
  assert.doesNotMatch(src, /\bdot\.offsetTop\b/, 'dot.offsetTop is relative to the <li> offsetParent, not the <ol> rect; dots would never track the line tip');
  assert.match(src, /dot\.getBoundingClientRect\(\)/, 'expected the dot center to be computed via dot.getBoundingClientRect() against the timeline rect');
});

// ---- T18 (rework issue 6 regression): setVisible/dispose must guard against a disposed renderer ----
