// Wires every add-to-cart button on pages that can change the cart.
import { loadCart, saveCart, onCartChange } from '../lib/cart-store.js';
import { addItem, parseQtyInput } from '../lib/cart-core.js';

const lang = document.documentElement.lang === 'en' ? 'en' : 'ar';
const status = document.getElementById('cart-status');

function qtyFor(button) {
  const inputId = button.getAttribute('data-qty-input');
  if (!inputId) return 1;
  const input = document.getElementById(inputId);
  if (!input) return 1;
  const parsed = parseQtyInput(input.value);
  return parsed ?? 1;
}

document.querySelectorAll('button[data-add-to-cart]').forEach((button) => {
  button.addEventListener('click', () => {
    const slug = button.getAttribute('data-add-to-cart');
    const qty = qtyFor(button);
    saveCart(addItem(loadCart(), slug, qty));
    if (status) {
      const template = button.getAttribute('data-added-template') || '';
      status.textContent = template.replace('{name}', button.getAttribute('data-name') || '');
    }
    showAdded(button);
  });
});

// Visible confirmation on the button itself for ~2s. The screen-reader announcement is #cart-status
// above, so the tick is aria-hidden.
const addedTimers = new WeakMap();
function showAdded(button) {
  const labelEl = button.querySelector('[data-btn-label]');
  if (!labelEl) return;
  if (!button.dataset.idleLabel) button.dataset.idleLabel = labelEl.textContent;
  labelEl.textContent = `${button.getAttribute('data-added-label')} `;
  const tick = document.createElement('span');
  tick.setAttribute('aria-hidden', 'true');
  tick.textContent = '✓';
  labelEl.appendChild(tick);
  button.dataset.added = '';
  clearTimeout(addedTimers.get(button));
  addedTimers.set(button, setTimeout(() => {
    labelEl.textContent = button.dataset.idleLabel;
    delete button.dataset.added;
  }, 2000));
}

// Kept in sync in case another tab or the cart page changes items while this page is open.
onCartChange(() => {});

