// Pure checkout helpers. No DOM, no storage: safe in client bundles and node tests.
import { toPageDigits } from './price-format.js';

export { toPageDigits };

const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';

export function toLatinDigits(s) {
  return String(s).replace(/[٠-٩]/g, (d) => String(ARABIC_INDIC.indexOf(d)));
}

// ponytail: format check only (8-15 digits, optional +, spaces/dashes allowed); a real store
// would verify Egyptian mobile prefixes server-side.
export function isValidPhone(s) {
  const compact = toLatinDigits(s).trim().replace(/[\s\-()]/g, '');
  return /^\+?\d{8,15}$/.test(compact);
}

// The summary as [label, value] rows, from what the user entered. Everything shown back uses the
// page's digits. `t` looks up a UI string; `lists` holds the branches/slots/payments arrays.
export function summaryRows(entry, t, lists, lang) {
  const digits = (s) => toPageDigits(s, lang);
  const sep = lang === 'ar' ? '، ' : ', ';
  const rows = [
    [t('sum_name'), entry.name.trim()],
    [t('sum_phone'), digits(entry.phone.trim())],
    [t('sum_method'), entry.method === 'delivery' ? t('method_delivery') : t('method_pickup')],
  ];
  if (entry.method === 'delivery') {
    const { area, street, building, landmark } = entry.address;
    rows.push([t('sum_address'), digits([area, street, building, landmark].map((x) => x.trim()).filter(Boolean).join(sep))]);
  } else {
    rows.push([t('sum_branch'), lists.branches[entry.branchIndex]]);
  }
  rows.push([t('sum_time'), lists.slots[entry.slotIndex]]);
  rows.push([t('sum_payment'), lists.payments[entry.paymentIndex]]);
  return rows;
}

// "DEMO-" + 4 random digits (in the page's digits). `random` is injectable for tests.
export function demoOrderNumber(lang, random = Math.random) {
  const digits = String(Math.floor(random() * 10000)).padStart(4, '0');
  return `DEMO-${toPageDigits(digits, lang)}`;
}

// What the confirmation screen shows, captured before the order data is cleared.
export function confirmationRows(order, t, lang) {
  const rows = [
    [t('order_no'), order.orderNo],
    [t('item_count'), toPageDigits(order.count, lang)],
    [t('total'), order.total],
    [t('sum_method'), order.method === 'delivery' ? t('method_delivery') : t('method_pickup')],
  ];
  if (order.method === 'pickup') rows.push([t('sum_branch'), order.branch]);
  rows.push([t('sum_time'), order.slot]);
  return rows;
}
