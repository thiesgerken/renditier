import { find } from 'lodash';

export const findStock = (stocks, isin) => {
  if (stocks.items === null) return null;
  return find(stocks.items, x => x.isin === isin) || null;
};

export const abbreviateTitle = (title, shorten) => {
  if (shorten !== undefined && shorten !== null && !shorten) return title;

  return title
    .replace(/ETF/i, '')
    .replace(/UCITS/i, '')
    .replace(/ISHARES/, 'ISHRS')
    .replace(/LYXOR/, 'LYX')
    .replace(/AMUNDI/, 'AMNDI')
    .replace(/ - /, ' ')
    .replace(/\s{2,}/, ' ')
    .trim();
};
