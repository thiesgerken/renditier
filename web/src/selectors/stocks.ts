import { find, unescape } from 'lodash';

import type { Stock, StockBreakdownEntry, StockHolding } from '../types/api';
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

// A part of a fund, in percent of the fund.
export interface FundShare {
  label: string;
  value: number;
}

// The `Stock` columns that carry a StockBreakdownEntry[] encoded as a JSON
// string.
export type BreakdownKind =
  | 'industryBreakdown'
  | 'instrumentBreakdown'
  | 'countryBreakdown'
  | 'currencyBreakdown';

// onvista names the same country differently depending on the fund.
const normalizeCountry = (name: string): string =>
  name === 'Vereinigte Staaten' || name === 'Vereinigte Staaten von Amerika'
    ? 'USA'
    : name;

// The breakdown columns hold onvista's JSON verbatim (see types/api.ts), which
// is sometimes the JSON `null` rather than a missing value.
const parseOnvistaList = <T>(raw: string | null): T[] | null =>
  raw === null ? null : (JSON.parse(raw) as T[] | null);

export const breakdownShares = (
  stock: Stock,
  kind: BreakdownKind
): FundShare[] =>
  (parseOnvistaList<StockBreakdownEntry>(stock[kind]) ?? []).map(e => ({
    label:
      kind === 'countryBreakdown'
        ? normalizeCountry(e.nameBreakdown)
        : e.nameBreakdown,
    value: e.investmentPct,
  }));

// null when onvista has no holdings for the stock
export const holdingShares = (stock: Stock): FundShare[] | null =>
  parseOnvistaList<StockHolding>(stock.holdings)?.map(h => ({
    label: unescape(h.instrument.name).replace('/The', ''),
    value: h.investmentPct,
  })) ?? null;
