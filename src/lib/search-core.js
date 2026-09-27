// Pure search matching. No DOM, no site.json import: safe in client bundles and node tests.

// lowercase, strip Latin diacritics, strip Arabic tashkeel/tatweel, normalize Arabic letter
// variants and Arabic-Indic digits, collapse punctuation/whitespace to single spaces, trim.
export function normalizeForSearch(s) {
  let out = String(s).toLowerCase();
  // Arabic normalization first: precomposed letters (e.g. "أ") would otherwise decompose under
  // NFD into a base letter plus a combining mark that these substitutions no longer match.
  out = out.replace(/[ً-ْـ]/g, ''); // Arabic tashkeel + tatweel
  out = out.replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');
  out = out.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
  out = out.normalize('NFD').replace(/[̀-ͯ]/g, ''); // Latin combining diacritics
  out = out.replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  return out;
}

// Empty normalized query matches everything. Otherwise every space-separated query token must
// be a substring of the normalized haystack.
export function matchesQuery(haystack, query) {
  const nq = normalizeForSearch(query);
  if (nq === '') return true;
  const nh = normalizeForSearch(haystack);
  return nq.split(' ').filter(Boolean).every((token) => nh.includes(token));
}
