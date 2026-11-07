import { normalizeCountry } from './stocks';

// onvista names countries and currencies in German, but not quite the way the
// browser does ("Hongkong Dollar", "Japanische Yen"), so names are compared
// by their letters only, and the few that differ in words are listed.
const key = (name: string) => name.toLowerCase().replace(/[^\p{L}]/gu, '');

const ONVISTA_COUNTRIES: Record<string, string> = {
  Großbritannien: 'GB',
};

const ONVISTA_CURRENCIES: Record<string, string> = {
  'Chinesischer Renminbi Yuan': 'CNY',
  'Israelischer Neuer Shekel': 'ILS',
  'Mexikanische Peso Nuevo': 'MXN',
  'Pfund Sterling': 'GBP',
  'Polnischer Zloty': 'PLN',
  'Vereinigte Arabische Emirate Dirham': 'AED',
};

const lookup = (entries: [string, string][]) => {
  const codes = new Map<string, string>();
  entries.forEach(([name, code]) => {
    if (!codes.has(key(name))) codes.set(key(name), code);
  });
  return codes;
};

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// Built on first use: it asks Intl for several hundred names.
let countries: Map<string, string> | undefined;
let currencies: Map<string, string> | undefined;

const countryCodes = () => {
  const names = new Intl.DisplayNames('de', { type: 'region' });
  const codes = [...LETTERS].flatMap(a => [...LETTERS].map(b => a + b));

  return lookup([
    ...Object.entries(ONVISTA_COUNTRIES),
    ...codes.flatMap((code): [string, string][] => {
      const name = names.of(code);
      // unknown codes come back unchanged
      if (name === undefined || name === code) return [];
      // retired codes ("DD") share the name of their successor ("DE")
      const current = Intl.getCanonicalLocales(`und-${code}`)[0].slice(4);
      return [[normalizeCountry(name), current]];
    }),
  ]);
};

// onvista uses both "Norwegische Krone" and "Dänische Kronen", so both the
// singular and the plural name count.
const currencyCodes = () => {
  const singular = new Intl.DisplayNames('de', { type: 'currency' });
  const plural = (code: string) =>
    new Intl.NumberFormat('de', {
      style: 'currency',
      currency: code,
      currencyDisplay: 'name',
    })
      .formatToParts(2)
      .find(part => part.type === 'currency')?.value;

  return lookup([
    ...Object.entries(ONVISTA_CURRENCIES),
    ...Intl.supportedValuesOf('currency').flatMap(code =>
      [singular.of(code), plural(code)].flatMap((name): [string, string][] =>
        name === undefined ? [] : [[name, code]]
      )
    ),
  ]);
};

// The ISO 3166 code of an onvista country name; null for "Global",
// "Barmittel" and the like.
export const countryCode = (name: string): string | null => {
  countries ??= countryCodes();
  return countries.get(key(name)) ?? null;
};

// The ISO 4217 code of an onvista currency name.
export const currencyCode = (name: string): string | null => {
  currencies ??= currencyCodes();
  return currencies.get(key(name)) ?? null;
};
