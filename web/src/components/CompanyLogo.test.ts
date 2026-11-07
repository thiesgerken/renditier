import { LOGOS, themeIcon } from './CompanyLogo';

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

describe('themeIcon', () => {
  const themeOf = (name: string) => themeIcon(name)?.displayName;

  it('reads a fund theme from its name, the specific one first', () => {
    expect(themeOf('EUWAX Gold II')).toBe(themeOf('Gold'));
    expect(themeOf('MSCI World Gold Miners UCITS ETF')).toBe(themeOf('Gold'));
    expect(themeOf('iShares Global Water UCITS ETF')).toBe(themeOf('Water'));
    expect(themeOf('Invesco Global Clean Energy UCITS ETF')).toBe(
      themeOf('Solar')
    );
    expect(themeOf('Lyxor MSCI World Energy TR UCITS ETF')).toBe(
      themeOf('Oil')
    );
    expect(themeOf('Amundi Stoxx Global Artificial Intelligence')).toBe(
      themeOf('Digitalisation')
    );
    expect(themeOf('iShares STOXX Europe 600 UCITS ETF')).toBe(themeOf('Euro'));
    expect(themeOf('SPDR MSCI ACWI UCITS ETF')).toBe(themeOf('World'));
  });

  it('only matches whole words', () => {
    expect(themeIcon('Goldman Sachs')).toBeUndefined();
    expect(themeIcon('Euronext')).toBeUndefined();
    expect(themeIcon('Eurofins Scientific')).toBeUndefined();
    expect(themeIcon('Soil Machine Dynamics')).toBeUndefined();
    expect(themeIcon('Waterstones')).toBeUndefined();
    expect(themeIcon('Worldline')).toBeUndefined();
    expect(themeIcon('Mail.ru')).toBeUndefined();
  });

  it('leaves names without a theme alone', () => {
    expect(themeIcon('Core S&P 500')).toBeUndefined();
  });
});
