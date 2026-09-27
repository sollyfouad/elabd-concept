// Pure price/number formatting helpers. No DOM, no site.json import: safe in client bundles and node tests.

export function formatNum(n, lang) {
  return Number(n).toLocaleString(lang === 'en' ? 'en-US' : 'ar-EG', { useGrouping: false });
}

// e.g. '٥٥ ج.م.', '139.5 – 167.4 EGP', 'from 139.5 EGP'
export function formatPrice(n, to, lang, currency, fromLabel) {
  const body = `${formatNum(n, lang)}${to ? ` – ${formatNum(to, lang)}` : ''} ${currency}`;
  return fromLabel ? `${fromLabel} ${body}` : body;
}

// Latin digits inside free text (e.g. "150 جم" in a fetched description) -> the page's digits.
export function toPageDigits(s, lang) {
  return lang === 'ar' ? String(s).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]) : String(s);
}

export function roundMoney(n) {
  return Math.round(n * 100) / 100;
}
