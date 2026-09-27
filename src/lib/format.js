import site from '../data/site.json';
import { formatNum, formatPrice } from './price-format.js';
import { localizeHref } from './i18n.js';

// Arabic-Indic digits site-wide, no thousands separator.
export const ar = (n) => Number(n).toLocaleString('ar-EG', { useGrouping: false });
export const allProducts = [...site.best_sellers, ...site.new_products, ...site.catalog];

// Google Maps search for a branch. Always queried in Arabic (brand + branch), which finds them more reliably in Egypt.
export const mapUrl = (branchAr) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${site.brand.name_ar} ${branchAr}`)}`;

// Arabic-Indic for 'ar', Latin for 'en'; no grouping in both.
export const num = (n, lang = 'ar') => formatNum(n, lang);

// ar: '٥٥ ج.م.' / '١٣٩٫٥ – ١٦٧٫٤ ج.م.' ; en: '55 EGP' / '139.5 – 167.4 EGP'
export const price = (n, to, lang = 'ar') => formatPrice(n, to, lang, site[`currency_${lang}`]);

// Every product in the four product arrays, deduped by slug (first wins).
const rawStoreProducts = [
  ...site.best_sellers,
  ...site.new_products,
  ...site.catalog,
  ...site.seasonal[site.seasonal.active].products,
];
const seenSlugs = new Map();
export const storeProducts = [];
for (const p of rawStoreProducts) {
  if (!p.slug) throw new Error(`Missing slug on product: ${p.ar}`);
  const existing = seenSlugs.get(p.slug);
  if (existing) {
    if (existing.img !== p.img) throw new Error(`Duplicate product slug: ${p.slug}`);
    continue;
  }
  seenSlugs.set(p.slug, p);
  storeProducts.push(p);
}

// '/products/<slug>' localized to the page language.
export const productHref = (p, lang) => localizeHref(`/products/${p.slug}`, lang);

// undefined for seasonal products, which have no category.
export const categoryOf = (p) => site.categories.find((c) => c.slug === p.category);

// Suffixed-key lookup: t(site.ui, 'order', 'en') -> site.ui.order_en.
export function t(obj, key, lang) {
  const v = obj[`${key}_${lang}`];
  if (v === undefined) throw new Error(`Missing i18n key ${key}_${lang}`);
  return v;
}

// Bare-key lookup for items shaped { ar, en }: label(category, 'en') -> category.en.
export function label(item, lang) {
  const v = item[lang];
  if (!v) throw new Error(`Missing "${lang}" on item ${JSON.stringify(item.ar)}`);
  return v;
}
