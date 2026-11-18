// Pure i18n helpers. No Astro imports; safe to unit-test directly.

export const LANGS = ['ar', 'en'];
export const DEFAULT_LANG = 'ar';

export const dir = (lang) => (lang === 'ar' ? 'rtl' : 'ltr');
export const otherLang = (lang) => (lang === 'ar' ? 'en' : 'ar');

// '/menu/' -> '/menu', '/' -> '/', '/en/' -> '/en'
export function normalizePath(pathname) {
  if (pathname === '/') return '/';
  return pathname.replace(/\/+$/, '') || '/';
}

// Internal, unprefixed path -> path in `lang`.
// ar: returned unchanged (normalized). en: '/' -> '/en/', '/menu' -> '/en/menu', '/menu/bakery' -> '/en/menu/bakery'.
// Hrefs that don't start with '/' (e.g. '#bakery', 'tel:17111', 'https://…') are returned unchanged.
const BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL)
  ? import.meta.env.BASE_URL.replace(/\/$/, '')
  : '';

// '/en' -> '/', '/en/' -> '/', '/en/menu/' -> '/menu', '/menu' -> '/menu', '/enquiries' -> '/enquiries'
// Strips a leading BASE segment first, since Astro.url.pathname includes it when `base` is configured.
export function stripLocale(pathname) {
  if (BASE && pathname.startsWith(BASE)) {
    pathname = pathname.slice(BASE.length) || '/';
    if (!pathname.startsWith('/')) pathname = '/' + pathname;
  }
  if (pathname === '/en' || pathname === '/en/') return '/';
  if (pathname.startsWith('/en/')) {
    return normalizePath(pathname.slice(3));
  }
  return normalizePath(pathname);
}

export function localizeHref(href, lang) {
  if (!href.startsWith('/')) return href;
  // Guard against double-prefixing when href already carries BASE (e.g. derived from Astro.url.pathname).
  if (BASE && href.startsWith(BASE)) {
    href = href.slice(BASE.length);
    if (!href.startsWith('/')) href = '/' + href;
  }
  if (lang === DEFAULT_LANG) return BASE + normalizePath(href);
  if (href === '/') return `${BASE}/en/`;
  return `${BASE}/en${normalizePath(href)}`;
}

// Given the current Astro.url.pathname, returns { ar: '/menu', en: '/en/menu' }.
export function alternates(pathname) {
  const base = stripLocale(pathname);
  return {
    ar: localizeHref(base, 'ar'),
    en: localizeHref(base, 'en'),
  };
}
