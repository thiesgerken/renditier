import { find } from 'lodash';

import type { Stock } from '../types/api';
import type { StocksState } from '../types/store';

export const findStock = (stocks: StocksState, isin: string): Stock | null => {
  if (stocks.data === null) return null;
  return find(stocks.data, x => x.isin === isin) || null;
};

export const capitalizeTitle = (title: string): string =>
  title
    .replace(/ISHARES/, 'iShares')
    .replace(/LYXOR/, 'Lyxor')
    .replace(/AMUNDI/, 'Amundi')
    .trim();

export const abbreviateTitle = (
  title: string | null | undefined,
  shorten?: boolean | null
): string => {
  if (title === null || title === undefined) return '';

  if (shorten !== undefined && shorten !== null && !shorten)
    return capitalizeTitle(title);

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
