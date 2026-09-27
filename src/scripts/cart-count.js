// The one script on every page: fills every cart badge, and focuses the header search field when
// its panel opens. Read-only: reads storage itself (via CART_KEY/parseCart
// from cart-core.js) instead of importing cart-store.js, so no write-side code ever reaches this
// bundle, on any page, even indirectly through a shared chunk.
import { CART_KEY, parseCart, countItems } from '../lib/cart-core.js';
import { formatNum } from '../lib/price-format.js';

const lang = document.documentElement.lang === 'en' ? 'en' : 'ar';

function readCart() {
  try {
    return parseCart(localStorage.getItem(CART_KEY));
  } catch {
    return [];
  }
}

function render(items) {
  const n = countItems(items);
  const shown = Math.min(n, 99);
  const text = n > 99 ? `${formatNum(99, lang)}+` : formatNum(shown, lang);
  document.querySelectorAll('[data-cart-count]').forEach((el) => {
    el.textContent = text;
    el.hidden = n === 0;
  });
  document.querySelectorAll('[data-cart-count-label]').forEach((el) => {
    const template = el.getAttribute('data-template') || '';
    el.textContent = template.replace('{n}', formatNum(n, lang));
  });
}

render(readCart());
window.addEventListener('cart:change', (e) => render(e.detail));
window.addEventListener('storage', (e) => {
  if (e.key === CART_KEY) render(readCart());
});

// ponytail: lives here because this is the only script every page already loads.
document.querySelectorAll('header details').forEach((panel) => {
  panel.addEventListener('toggle', () => {
    if (panel.open) panel.querySelector('input[type="search"]')?.focus();
  });
});
