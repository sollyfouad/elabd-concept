import site from '../data/site.json';

// schema.org graph: one Organization plus one Bakery per branch.
// Only facts already in site.json; no street addresses exist yet, so each branch carries country only.
// TODO: add real streetAddress/addressLocality/geo per branch once the client provides them.
export function structuredData(lang, siteUrl) {
  const { brand, contact } = site;
  const orgId = new URL('/#organization', siteUrl).href;
  const name = lang === 'en' ? brand.name_en : brand.name_ar;
  const altName = lang === 'en' ? brand.name_ar : brand.name_en;
  const branches = lang === 'en' ? site.branches_en : site.branches_ar;
  const hours = [{
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    opens: '09:00',
    closes: '00:00',
  }];
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': orgId,
        name,
        alternateName: altName,
        url: new URL(lang === 'en' ? '/en/' : '/', siteUrl).href,
        logo: brand.logo,
        foundingDate: String(brand.since),
        telephone: contact.hotline,
        sameAs: Object.values(contact.social),
      },
      ...branches.map((b) => ({
        '@type': 'Bakery',
        name: `${name} – ${b}`,
        parentOrganization: { '@id': orgId },
        telephone: contact.hotline,
        openingHoursSpecification: hours,
        address: { '@type': 'PostalAddress', addressCountry: 'EG' },
      })),
    ],
  };
}
