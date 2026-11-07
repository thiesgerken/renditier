import { LOGOS } from './CompanyLogo';

// An ISIN's last digit checks the others (Luhn over the letters spelled as
// numbers, A = 10), so a typo would silently cost a company its logo.
const isValidIsin = (isin: string) => {
  if (!/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(isin)) return false;

  const digits = [...isin].map(c => parseInt(c, 36)).join('');
  const sum = [...digits]
    .reverse()
    .map(Number)
    .reduce((acc, d, i) => {
      if (i % 2 === 0) return acc + d;
      return acc + (d * 2 > 9 ? d * 2 - 9 : d * 2);
    }, 0);

  return sum % 10 === 0;
};

describe('LOGOS', () => {
  it('is keyed by valid ISINs', () => {
    const invalid = Object.keys(LOGOS).filter(isin => !isValidIsin(isin));
    expect(invalid).toEqual([]);
  });

  it('notices a typo', () => {
    expect(isValidIsin('US0378331005')).toBe(true);
    expect(isValidIsin('US0378331006')).toBe(false);
  });
});
