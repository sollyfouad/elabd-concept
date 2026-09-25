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

// '/en' -> '/', '/en/' -> '/', '/en/menu/' -> '/menu', '/menu' -> '/menu', '/enquiries' -> '/enquiries'
export function stripLocale(pathname) {
  if (pathname === '/en' || pathname === '/en/') return '/';
  if (pathname.startsWith('/en/')) {
    return normalizePath(pathname.slice(3));
  }
  return normalizePath(pathname);
}

// Internal, unprefixed path -> path in `lang`.
// ar: returned unchanged (normalized). en: '/' -> '/en/', '/menu' -> '/en/menu', '/menu/bakery' -> '/en/menu/bakery'.
// Hrefs that don't start with '/' (e.g. '#bakery', 'tel:17111', 'https://…') are returned unchanged.
export function localizeHref(href, lang) {
  if (!href.startsWith('/')) return href;
  if (lang === DEFAULT_LANG) return normalizePath(href);
  if (href === '/') return '/en/';
  return `/en${normalizePath(href)}`;
}

// Given the current Astro.url.pathname, returns { ar: '/menu', en: '/en/menu' }.
export function alternates(pathname) {
  const base = stripLocale(pathname);
  return {
    ar: localizeHref(base, 'ar'),
    en: localizeHref(base, 'en'),
  };
}
