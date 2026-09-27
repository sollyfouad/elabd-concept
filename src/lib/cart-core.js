// Pure cart logic. No DOM, no storage, no site.json import: safe in client bundles and node tests.
import { roundMoney } from './price-format.js';

export const CART_KEY = 'elabd-cart-v1';
export const MAX_QTY = 20;

function clampQty(qty) {
  return Math.min(MAX_QTY, Math.max(1, Math.round(qty)));
}

// Accepts only {"v":1,"items":[{slug,qty}]}. Anything else returns []. Drops items with a bad
// slug or a non-numeric qty. Clamps qty to 1..MAX_QTY. Merges duplicate slugs (sum, clamped).
export function parseCart(raw) {
  if (typeof raw !== 'string') return [];
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!data || typeof data !== 'object' || data.v !== 1 || !Array.isArray(data.items)) return [];
  const merged = new Map();
  for (const it of data.items) {
    if (!it || typeof it !== 'object') continue;
    if (typeof it.slug !== 'string' || it.slug.length === 0) continue;
    if (typeof it.qty !== 'number' || !Number.isFinite(it.qty)) continue;
    const qty = clampQty(it.qty);
    merged.set(it.slug, Math.min(MAX_QTY, (merged.get(it.slug) || 0) + qty));
  }
  return [...merged.entries()].map(([slug, qty]) => ({ slug, qty }));
}

export function serializeCart(items) {
  return JSON.stringify({ v: 1, items });
}

// New array. Adds to the existing line or appends a new one. The line qty is clamped to MAX_QTY.
export function addItem(items, slug, qty) {
  const q = Number.isFinite(qty) ? Math.max(1, Math.round(qty)) : 1;
  const idx = items.findIndex((it) => it.slug === slug);
  if (idx === -1) return [...items, { slug, qty: Math.min(MAX_QTY, q) }];
  const next = items.slice();
  next[idx] = { ...next[idx], qty: Math.min(MAX_QTY, next[idx].qty + q) };
  return next;
}

// Clamps to 1..MAX_QTY. Non-finite qty returns `items` unchanged.
export function setQty(items, slug, qty) {
  if (!Number.isFinite(qty)) return items;
  const clamped = clampQty(qty);
  return items.map((it) => (it.slug === slug ? { ...it, qty: clamped } : it));
}

export function removeItem(items, slug) {
  return items.filter((it) => it.slug !== slug);
}

export function countItems(items) {
  return items.reduce((sum, it) => sum + it.qty, 0);
}

export function pruneUnknown(items, validSlugs) {
  return items.filter((it) => validSlugs.has(it.slug));
}

// total = roundMoney(Σ price × qty). Unknown slugs are ignored.
export function cartTotal(items, catalog) {
  let total = 0;
  let hasRange = false;
  for (const it of items) {
    const p = catalog[it.slug];
    if (!p) continue;
    total += p.price * it.qty;
    if (p.price_to != null) hasRange = true;
  }
  return { total: roundMoney(total), hasRange };
}

// Converts Arabic-Indic digits to Latin, trims, accepts ^\d+$ only, otherwise returns null.
export function parseQtyInput(s) {
  if (typeof s !== 'string') return null;
  const latin = s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
  const trimmed = latin.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  return Number(trimmed);
}
