// Are the hotline and orders open right now, in Cairo time? Pure: takes the date and the [opens, closes] hours
// from site.json (closes may be 24 for midnight), so it is testable in node.
const cairoParts = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Cairo',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function isOpenInCairo(date, [opens, closes]) {
  const parts = Object.fromEntries(cairoParts.formatToParts(date).map((p) => [p.type, p.value]));
  const hour = Number(parts.hour) + Number(parts.minute) / 60;
  return hour >= opens && hour < closes;
}

// "10:42 PM" / "١٠:٤٢ م", in Cairo time and the page's digits.
export function cairoClock(date, lang) {
  return new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'ar-EG', {
    timeZone: 'Africa/Cairo',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}
