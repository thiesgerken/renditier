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
  Shapes,
  ShoppingBag,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { Stock } from '../types/api';
import type { BarItem } from './BarList';
import CompanyLogo from './CompanyLogo';
import { breakdownShares, holdingShares } from '../selectors/stocks';
import type { FundShare } from '../selectors/stocks';
import { countryCode, currencyCode } from '../selectors/onvistaNames';

// A country code spelled in regional indicator symbols is its flag emoji.
const flag = (code: string) =>
  String.fromCodePoint(
    ...Array.from(code, letter => 0x1f1e6 + letter.charCodeAt(0) - 65)
  );

const CountryFlag = ({ name }: { name: string }) => {
  const code = countryCode(name);
  return code === null ? null : <span aria-hidden>{flag(code)}</span>;
};

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
  INR: IndianRupee,
};

const CurrencyIcon = ({ name }: { name: string }) => {
  const code = currencyCode(name);
  if (code === null) return null;
  const Icon = CURRENCY_ICONS[code] ?? Coins;
  return <Icon aria-hidden className={MARKER} />;
};

// onvista's broad sectors, onto which normalizeIndustry maps the other names
// for them. Thematic funds list free-text industries, which get no icon.
export const SECTOR_ICONS: Partial<Record<string, LucideIcon>> = {
  'IT/Telekommunikation': Cpu,
  Konsumgüter: ShoppingBag,
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
  title: string;
  icon: LucideIcon;
  maxRows: number;
  // null for a stock that onvista has no holdings for
  shares: (stock: Stock) => FundShare[] | null;
  // shown before an item's label
  marker: (item: BarItem) => ReactNode;
}

// The parts of a fund, on the dashboard for the whole portfolio and on the
// stock page for one stock. Ten rows show a fund's top holdings and nearly all
// countries; industries get eleven so that all GICS sectors fit; currencies
// beyond the top five are noise.
export const BREAKDOWNS: Breakdown[] = [
  {
    title: 'Einzeltitel',
    icon: Layers,
    maxRows: 10,
    shares: holdingShares,
    // a holding always has its ISIN
    marker: ({ isin, label }) =>
      isin === undefined ? null : <CompanyLogo isin={isin} name={label} />,
  },
  {
    title: 'Branchen',
    icon: Shapes,
    maxRows: 11,
    shares: s => breakdownShares(s, 'industryBreakdown'),
    marker: ({ label }) => <SectorIcon name={label} />,
  },
  {
    title: 'Währungen',
    icon: Currency,
    maxRows: 5,
    shares: s => breakdownShares(s, 'currencyBreakdown'),
    marker: ({ label }) => <CurrencyIcon name={label} />,
  },
  {
    title: 'Länder',
    icon: Globe,
    maxRows: 10,
    shares: s => breakdownShares(s, 'countryBreakdown'),
    marker: ({ label }) => <CountryFlag name={label} />,
  },
];
