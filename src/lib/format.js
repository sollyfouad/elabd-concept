import site from '../data/site.json';

// Arabic-Indic digits site-wide, no thousands separator.
export const ar = (n) => Number(n).toLocaleString('ar-EG', { useGrouping: false });
export const price = (n) => `${ar(n)} ${site.currency_ar}`;
export const allProducts = [...site.best_sellers, ...site.new_products];
