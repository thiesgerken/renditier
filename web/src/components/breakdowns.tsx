import type { ReactNode } from 'react';
import {
  Banknote,
  Building,
  Coins,
  Cpu,
  Currency,
  DollarSign,
  Euro,
  Factory,
  Fuel,
  Globe,
  HeartPulse,
  IndianRupee,
  JapaneseYen,
  Landmark,
  Layers,
  Pickaxe,
  PoundSterling,
  RadioTower,
  Shapes,
  ShoppingBag,
  ShoppingBasket,
  SwissFranc,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import i18n from '../i18n';
import type { Stock } from '../types/api';
import type { BarItem } from './BarList';
import CompanyLogo from './CompanyLogo';
import { breakdownShares, holdingShares } from '../selectors/stocks';
import type { FundShare } from '../selectors/stocks';
import { countryCode, currencyCode } from '../selectors/onvistaNames';

// onvista names countries and currencies in German. Those with an ISO code
// are shown by the browser's name for it in the UI language, the others
// ("Global", "Barmittel") as onvista names them.
const named = (
  shares: FundShare[],
  type: 'region' | 'currency',
  codeOf: (name: string) => string | null
): FundShare[] => {
  const names = new Intl.DisplayNames(i18n.language, { type });

  return shares.map(share => {
    const code = codeOf(share.label);
    return code === null
      ? share
      : { ...share, label: names.of(code) ?? share.label, code };
  });
};

// A country code spelled in regional indicator symbols is its flag emoji.
const flag = (code: string) =>
  String.fromCodePoint(
    ...[...code].map(letter => 0x1f1e6 + letter.charCodeAt(0) - 65)
  );

const MARKER = 'size-4 shrink-0 text-muted-foreground';

// The label names the currency, so all dollars (and the pesos, which write
// "$" too) can share one sign; currencies without a Lucide icon get coins.
const CURRENCY_ICONS: Partial<Record<string, LucideIcon>> = {
  EUR: Euro,
  USD: DollarSign,
  AUD: DollarSign,
  CAD: DollarSign,
  HKD: DollarSign,
  NZD: DollarSign,
  SGD: DollarSign,
  TWD: DollarSign,
  MXN: DollarSign,
  CLP: DollarSign,
  GBP: PoundSterling,
  JPY: JapaneseYen,
  CNY: JapaneseYen,
  CHF: SwissFranc,
  INR: IndianRupee,
};

const CurrencyIcon = ({ code }: { code: string }) => {
  const Icon = CURRENCY_ICONS[code] ?? Coins;
  return <Icon aria-hidden className={MARKER} />;
};

// onvista's broad sectors, which most funds use, and the GICS names some use
// instead. Thematic funds list free-text industries, which get no icon.
const SECTOR_ICONS: Partial<Record<string, LucideIcon>> = {
  'IT/Telekommunikation': Cpu,
  Informationstechnologie: Cpu,
  Telekomdienste: RadioTower,
  Konsumgüter: ShoppingBag,
  'Konsumgüter zyklisch': ShoppingBag,
  Basiskonsumgüter: ShoppingBasket,
  Finanzen: Landmark,
  Gesundheitswesen: HeartPulse,
  Industrie: Factory,
  Energie: Fuel,
  Rohstoffe: Pickaxe,
  Versorger: Zap,
  Immobilien: Building,
  Barmittel: Banknote,
};

const SectorIcon = ({ name }: { name: string }) => {
  const Icon = SECTOR_ICONS[name];
  return Icon === undefined ? null : <Icon aria-hidden className={MARKER} />;
};

export interface Breakdown {
  id: 'holdings' | 'industries' | 'currencies' | 'countries';
  icon: LucideIcon;
  maxRows: number;
  // null for a stock that onvista has no holdings for
  shares: (stock: Stock) => FundShare[] | null;
  // shown before an item's label
  marker: (item: BarItem) => ReactNode;
}

// The parts of a fund, on the dashboard for the whole portfolio and on the
// stock page for one stock, titled by `breakdowns.*`. Ten rows show a fund's
// top holdings and nearly all countries; industries get eleven so that all
// GICS sectors fit; currencies beyond the top five are noise.
export const BREAKDOWNS: Breakdown[] = [
  {
    id: 'holdings',
    icon: Layers,
    maxRows: 10,
    shares: holdingShares,
    // a holding always has its ISIN
    marker: ({ isin, label }) =>
      isin === undefined ? null : <CompanyLogo isin={isin} name={label} />,
  },
  {
    id: 'industries',
    icon: Shapes,
    maxRows: 11,
    shares: s => breakdownShares(s, 'industryBreakdown'),
    marker: ({ label }) => <SectorIcon name={label} />,
  },
  {
    id: 'currencies',
    icon: Currency,
    maxRows: 5,
    shares: s =>
      named(breakdownShares(s, 'currencyBreakdown'), 'currency', currencyCode),
    marker: ({ code }) =>
      code === undefined ? null : <CurrencyIcon code={code} />,
  },
  {
    id: 'countries',
    icon: Globe,
    maxRows: 10,
    shares: s =>
      named(breakdownShares(s, 'countryBreakdown'), 'region', countryCode),
    marker: ({ code }) =>
      code === undefined ? null : <span aria-hidden>{flag(code)}</span>,
  },
];
