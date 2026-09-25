import site from '../data/site.json';

// Arabic-Indic digits site-wide, no thousands separator.
export const ar = (n) => Number(n).toLocaleString('ar-EG', { useGrouping: false });
export const allProducts = [...site.best_sellers, ...site.new_products, ...site.catalog];

// Arabic-Indic for 'ar', Latin for 'en'; no grouping in both.
export const num = (n, lang = 'ar') => Number(n).toLocaleString(lang === 'en' ? 'en-US' : 'ar-EG', { useGrouping: false });

// ar: '٥٥ ج.م.' / '١٣٩٫٥ – ١٦٧٫٤ ج.م.' ; en: '55 EGP' / '139.5 – 167.4 EGP'
export const price = (n, to, lang = 'ar') => `${num(n, lang)}${to ? ` – ${num(to, lang)}` : ''} ${site[`currency_${lang}`]}`;

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
