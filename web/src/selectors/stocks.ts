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
  // set for a holding, which is a company of its own
  isin?: string;
}

// The `Stock` columns that carry a StockBreakdownEntry[] encoded as a JSON
// string.
export type BreakdownKind =
  | 'industryBreakdown'
  | 'instrumentBreakdown'
  | 'countryBreakdown'
  | 'currencyBreakdown';

// onvista names the same country differently depending on the fund.
export const normalizeCountry = (name: string): string =>
  name === 'Vereinigte Staaten' || name === 'Vereinigte Staaten von Amerika'
    ? 'USA'
    : name;

// onvista names industries differently depending on the fund: most funds use
// its broad sectors, one uses the GICS sectors, thematic funds split a sector
// into sub-names (sometimes misspelled). Each name maps onto the broad sector
// or the plain name, so that the dashboard adds up the same industry across
// funds. Only names that mean the same thing are listed; distinct industries
// of thematic funds ("Halbleiterelektronik") stay as they are.
const INDUSTRY_NAMES: Record<string, string> = {
  Informationstechnologie: 'IT/Telekommunikation',
  Telekomdienste: 'IT/Telekommunikation',
  Basiskonsumgüter: 'Konsumgüter',
  'Konsumgüter zyklisch': 'Konsumgüter',
  'Versorger umfassend': 'Versorger',
  'Versorger/ erneuerbare Energie': 'Versorger',
  'Vesorger/Strom konventionell/ Enegiefirmen': 'Versorger',
  'Stromversorgung konv.': 'Versorger',
  'Chemikalien spezial': 'Chemikalien',
  'Computer Hardware': 'Computer und Zubehör',
};

export const normalizeIndustry = (name: string): string =>
  INDUSTRY_NAMES[name] ?? name;

const normalizeName = (kind: BreakdownKind, name: string): string => {
  if (kind === 'countryBreakdown') return normalizeCountry(name);
  if (kind === 'industryBreakdown') return normalizeIndustry(name);
  return name;
};

// The breakdown columns hold onvista's JSON verbatim (see types/api.ts), which
// is sometimes the JSON `null` rather than a missing value.
const parseOnvistaList = <T>(raw: string | null): T[] | null =>
  raw === null ? null : (JSON.parse(raw) as T[] | null);

// A fund's shares by normalized name; names that normalize to the same one
// add up, so that each shows once.
export const breakdownShares = (
  stock: Stock,
  kind: BreakdownKind
): FundShare[] => {
  const shares = new Map<string, number>();
  (parseOnvistaList<StockBreakdownEntry>(stock[kind]) ?? []).forEach(e => {
    const label = normalizeName(kind, e.nameBreakdown);
    shares.set(label, (shares.get(label) ?? 0) + e.investmentPct);
  });

  return Array.from(shares, ([label, value]) => ({ label, value }));
};

// null when onvista has no holdings for the stock
export const holdingShares = (stock: Stock): FundShare[] | null =>
  parseOnvistaList<StockHolding>(stock.holdings)?.map(h => ({
    label: unescape(h.instrument.name).replace('/The', ''),
    value: h.investmentPct,
    isin: h.instrument.isin,
  })) ?? null;
