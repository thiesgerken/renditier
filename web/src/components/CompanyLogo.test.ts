import { Brain, Coins, Droplet, Euro, Fuel, Globe, Sun } from 'lucide-react';

import { LOGOS, themeOf } from './CompanyLogo';

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

describe('themeOf', () => {
  const iconOf = (name: string) => themeOf(name)?.icon;

  it('reads a fund theme from its name, the specific one first', () => {
    expect(iconOf('EUWAX Gold II')).toBe(Coins);
    expect(iconOf('MSCI World Gold Miners UCITS ETF')).toBe(Coins);
    expect(iconOf('iShares Global Water UCITS ETF')).toBe(Droplet);
    expect(iconOf('Invesco Global Clean Energy UCITS ETF')).toBe(Sun);
    expect(iconOf('Lyxor MSCI World Energy TR UCITS ETF')).toBe(Fuel);
    expect(iconOf('Amundi Stoxx Global Artificial Intelligence')).toBe(Brain);
    expect(iconOf('iShares Digitalisation UCITS ETF')).toBe(Brain);
    expect(iconOf('iShares STOXX Europe 600 UCITS ETF')).toBe(Euro);
    expect(iconOf('SPDR MSCI ACWI UCITS ETF')).toBe(Globe);
  });

  it('only matches whole words', () => {
    expect(themeOf('Goldman Sachs')).toBeUndefined();
    expect(themeOf('Euronext')).toBeUndefined();
    expect(themeOf('Eurofins Scientific')).toBeUndefined();
    expect(themeOf('Soil Machine Dynamics')).toBeUndefined();
    expect(themeOf('Waterstones')).toBeUndefined();
    expect(themeOf('Worldline')).toBeUndefined();
    expect(themeOf('Mail.ru')).toBeUndefined();
  });

  it('leaves names without a theme alone', () => {
    expect(themeOf('Core S&P 500')).toBeUndefined();
  });
});
