// The only module that touches storage. Falls back to an in-memory value when localStorage
// throws (Safari private mode) or is unavailable, so the cart still works for the page lifetime.
import { CART_KEY, parseCart, serializeCart } from './cart-core.js';

let memoryFallback = null;

export function loadCart() {
  try {
    return parseCart(localStorage.getItem(CART_KEY));
  } catch {
    return parseCart(memoryFallback);
  }
}

export function saveCart(items) {
  const raw = serializeCart(items);
  try {
    localStorage.setItem(CART_KEY, raw);
  } catch {
    memoryFallback = raw;
  }
  window.dispatchEvent(new CustomEvent('cart:change', { detail: items }));
}

// Used once, by the demo checkout's confirm button: an order was "placed", so the cart empties.
export function clearCart() {
  memoryFallback = null;
  try {
    localStorage.removeItem(CART_KEY);
  } catch {
    // storage unavailable: the in-memory fallback is already cleared
  }
  window.dispatchEvent(new CustomEvent('cart:change', { detail: [] }));
}

export function onCartChange(cb) {
  window.addEventListener('cart:change', (e) => cb(e.detail));
  window.addEventListener('storage', (e) => {
    if (e.key === CART_KEY) cb(loadCart());
  });
}
