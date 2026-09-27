// Qty stepper and photo gallery on the product page.
import { MAX_QTY, parseQtyInput } from '../lib/cart-core.js';
import { formatNum } from '../lib/price-format.js';

const lang = document.documentElement.lang === 'en' ? 'en' : 'ar';

const qtyInput = document.getElementById('qty');
const dec = document.querySelector('[data-qty-dec]');
const inc = document.querySelector('[data-qty-inc]');

function clamp(n) {
  return Math.min(MAX_QTY, Math.max(1, n));
}

let lastValid = 1;

function setQty(n) {
  if (!qtyInput) return;
  lastValid = clamp(n);
  qtyInput.value = formatNum(lastValid, lang);
  if (dec) dec.disabled = lastValid <= 1;
  if (inc) inc.disabled = lastValid >= MAX_QTY;
}

if (qtyInput) {
  setQty(parseQtyInput(qtyInput.value) ?? 1);

  dec?.addEventListener('click', () => setQty(lastValid - 1));
  inc?.addEventListener('click', () => setQty(lastValid + 1));

  qtyInput.addEventListener('change', () => {
    const parsed = parseQtyInput(qtyInput.value);
    setQty(parsed ?? lastValid);
  });
}

const mainImg = document.querySelector('[data-gallery-main]');
document.querySelectorAll('button[data-gallery-thumb]').forEach((thumb) => {
  thumb.addEventListener('click', () => {
    if (!mainImg) return;
    const src = thumb.getAttribute('data-full');
    const alt = thumb.getAttribute('data-alt') || '';
    if (src) mainImg.setAttribute('src', src);
    mainImg.setAttribute('alt', alt);
    document.querySelectorAll('button[data-gallery-thumb]').forEach((t) => {
      t.setAttribute('aria-pressed', String(t === thumb));
    });
  });
});
