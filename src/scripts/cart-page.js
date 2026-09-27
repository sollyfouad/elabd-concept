// Renders the /cart page from localStorage + the embedded catalog/strings JSON. Does not import
// site.json: only the few strings this page needs are embedded (see #cart-strings in CartView.astro),
// so the client bundle does not carry the whole catalog's descriptions.
import { loadCart, saveCart, onCartChange } from '../lib/cart-store.js';
import { removeItem, setQty, parseQtyInput, pruneUnknown, cartTotal, MAX_QTY } from '../lib/cart-core.js';
import { formatPrice, formatNum, roundMoney } from '../lib/price-format.js';

const lang = document.documentElement.lang === 'en' ? 'en' : 'ar';
const stringsEl = document.getElementById('cart-strings');
const strings = stringsEl ? JSON.parse(stringsEl.textContent) : {};
const currency = strings.currency;
const t = (key) => strings[key];
const fill = (s, vars) => Object.entries(vars).reduce((acc, [k, v]) => acc.split(`{${k}}`).join(v), s);

const h1 = document.querySelector('main h1');
const linesEl = document.querySelector('[data-cart-lines]');
const emptyEl = document.querySelector('[data-cart-empty]');
const totalEl = document.querySelector('[data-cart-total]');
const checkoutLink = document.querySelector('[data-checkout-link]');
const statusEl = document.getElementById('cart-status');
const catalogEl = document.getElementById('store-catalog');
const catalog = catalogEl ? JSON.parse(catalogEl.textContent) : {};
const validSlugs = new Set(Object.keys(catalog));

function buildLine(item) {
  const p = catalog[item.slug];
  const li = document.createElement('li');
  // Phones: image + name on the first row, qty/total/remove on the second. From sm up: one row.
  li.className = 'py-4 grid grid-cols-[4rem_1fr] items-center gap-x-3 gap-y-2 sm:flex';

  const img = document.createElement('img');
  img.src = p.img;
  img.alt = '';
  img.width = 80;
  img.height = 80;
  img.className = 'size-16 bg-rose object-contain mix-blend-multiply shrink-0';
  li.appendChild(img);

  const info = document.createElement('div');
  info.className = 'flex-1 min-w-0';
  const nameLink = document.createElement('a');
  nameLink.href = p.href;
  nameLink.textContent = p.name;
  nameLink.className = 'inline-flex items-center min-h-11 font-semibold text-maroon underline underline-offset-4';
  info.appendChild(nameLink);
  const unitPrice = document.createElement('p');
  unitPrice.className = 'whitespace-nowrap';
  unitPrice.textContent = formatPrice(p.price, null, lang, currency, p.price_to != null ? t('from') : undefined);
  info.appendChild(unitPrice);
  li.appendChild(info);

  const controls = document.createElement('div');
  controls.className = 'col-span-2 flex items-center gap-2 sm:contents';
  const stepper = document.createElement('div');
  stepper.className = 'flex items-center gap-1';

  const decBtn = document.createElement('button');
  decBtn.type = 'button';
  decBtn.textContent = '−';
  decBtn.className = 'flex items-center justify-center min-h-11 min-w-11 border border-maroon/30';
  decBtn.setAttribute('aria-label', fill(t('line_dec'), { name: p.name }));
  decBtn.disabled = item.qty <= 1;
  decBtn.addEventListener('click', () => saveCart(setQty(loadCart(), item.slug, item.qty - 1)));
  stepper.appendChild(decBtn);

  const qtyInput = document.createElement('input');
  qtyInput.type = 'text';
  qtyInput.inputMode = 'numeric';
  qtyInput.value = formatNum(item.qty, lang);
  qtyInput.className = 'min-h-11 w-12 text-center border border-maroon/30';
  qtyInput.setAttribute('aria-label', fill(t('line_qty'), { name: p.name }));
  qtyInput.addEventListener('change', () => {
    const parsed = parseQtyInput(qtyInput.value);
    saveCart(setQty(loadCart(), item.slug, parsed ?? item.qty));
  });
  stepper.appendChild(qtyInput);

  const incBtn = document.createElement('button');
  incBtn.type = 'button';
  incBtn.textContent = '+';
  incBtn.className = 'flex items-center justify-center min-h-11 min-w-11 border border-maroon/30';
  incBtn.setAttribute('aria-label', fill(t('line_inc'), { name: p.name }));
  incBtn.disabled = item.qty >= MAX_QTY;
  incBtn.addEventListener('click', () => saveCart(setQty(loadCart(), item.slug, item.qty + 1)));
  stepper.appendChild(incBtn);

  controls.appendChild(stepper);

  const lineTotal = document.createElement('p');
  lineTotal.className = 'ms-auto whitespace-nowrap text-end font-semibold';
  const amount = roundMoney(p.price * item.qty);
  const amountTo = null;
  lineTotal.textContent = formatPrice(amount, amountTo, lang, currency, p.price_to != null ? t('from') : undefined);
  controls.appendChild(lineTotal);

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.textContent = '×';
  removeBtn.dataset.removeSlug = item.slug;
  removeBtn.className = 'flex items-center justify-center min-h-11 min-w-11 text-maroon';
  removeBtn.setAttribute('aria-label', fill(t('remove'), { name: p.name }));
  removeBtn.addEventListener('click', () => onRemove(item.slug));
  controls.appendChild(removeBtn);
  li.appendChild(controls);

  return li;
}

function render(items) {
  linesEl.textContent = '';
  const isEmpty = items.length === 0;
  emptyEl.hidden = !isEmpty;
  if (checkoutLink) checkoutLink.hidden = isEmpty;
  for (const item of items) {
    if (!catalog[item.slug]) continue;
    linesEl.appendChild(buildLine(item));
  }
  const { total, hasRange } = cartTotal(items, catalog);
  totalEl.textContent = `${t('total')}: ${formatPrice(total, null, lang, currency, hasRange ? t('from') : undefined)}`;
}

function onRemove(slug) {
  const items = loadCart();
  const idx = items.findIndex((it) => it.slug === slug);
  const name = catalog[slug]?.name || '';
  saveCart(removeItem(items, slug));
  if (statusEl) statusEl.textContent = fill(t('removed'), { name });
  const removeButtons = [...linesEl.querySelectorAll('[data-remove-slug]')];
  if (removeButtons.length === 0) {
    h1.setAttribute('tabindex', '-1');
    h1.focus();
  } else {
    (removeButtons[idx] || removeButtons[removeButtons.length - 1]).focus();
  }
}

onCartChange((items) => render(pruneUnknown(items, validSlugs)));

const initial = loadCart();
const pruned = pruneUnknown(initial, validSlugs);
if (pruned.length !== initial.length) {
  saveCart(pruned);
} else {
  render(initial);
}
