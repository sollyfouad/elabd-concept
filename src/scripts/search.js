// Client-side filter for /search: no network, no build-time index. Does not import site.json:
// the one template string this page needs (`results`) travels on the count element's
// `data-template` attribute, so the client bundle does not carry the whole catalog's descriptions.
import { matchesQuery } from '../lib/search-core.js';
import { formatNum } from '../lib/price-format.js';

const lang = document.documentElement.lang === 'en' ? 'en' : 'ar';

const input = document.getElementById('search-q');
const items = [...document.querySelectorAll('[data-search-results] li[data-search]')];
const countEl = document.querySelector('[data-search-count]');
const emptyEl = document.querySelector('[data-search-empty]');

function apply() {
  const q = input.value;
  let shown = 0;
  for (const li of items) {
    const match = matchesQuery(li.getAttribute('data-search') || '', q);
    li.hidden = !match;
    if (match) shown += 1;
  }
  if (countEl) countEl.textContent = (countEl.dataset.template || '').replace('{n}', formatNum(shown, lang));
  if (emptyEl) emptyEl.hidden = shown !== 0;
}

const params = new URLSearchParams(window.location.search);
if (params.has('q')) input.value = params.get('q');

input.addEventListener('input', apply);
apply();
