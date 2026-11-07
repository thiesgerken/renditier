import type { ReactNode } from 'react';
import { Coins, Factory, Globe, Layers } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { Stock } from '../types/api';
import { breakdownShares, holdingShares } from '../selectors/stocks';
import type { FundShare } from '../selectors/stocks';
import { countryCode, currencyCode } from '../selectors/onvistaNames';
import { Badge } from './ui/badge';

// A country code spelled in regional indicator symbols is its flag emoji.
const flag = (code: string) =>
  String.fromCodePoint(
    ...[...code].map(letter => 0x1f1e6 + letter.charCodeAt(0) - 65)
  );

const CountryFlag = ({ name }: { name: string }) => {
  const code = countryCode(name);
  return code === null ? null : <span aria-hidden>{flag(code)}</span>;
};

const CurrencyBadge = ({ name }: { name: string }) => {
  const code = currencyCode(name);
  return code === null ? null : (
    <Badge variant="outline" className="h-4 px-1 font-mono text-[10px]">
      {code}
    </Badge>
  );
};

export interface Breakdown {
  title: string;
  icon: LucideIcon;
  maxRows: number;
  // null for a stock that onvista has no holdings for
  shares: (stock: Stock) => FundShare[] | null;
  // shown before an item's label
  marker?: (label: string) => ReactNode;
}

// The parts of a fund, on the dashboard for the whole portfolio and on the
// stock page for one stock. Ten rows show a fund's top holdings and nearly all
// countries; industries get eleven so that all GICS sectors fit; currencies
// beyond the top five are noise.
export const BREAKDOWNS: Breakdown[] = [
  { title: 'Einzeltitel', icon: Layers, maxRows: 10, shares: holdingShares },
  {
    title: 'Branchen',
    icon: Factory,
    maxRows: 11,
    shares: s => breakdownShares(s, 'industryBreakdown'),
  },
  {
    title: 'Währungen',
    icon: Coins,
    maxRows: 5,
    shares: s => breakdownShares(s, 'currencyBreakdown'),
    marker: name => <CurrencyBadge name={name} />,
  },
  {
    title: 'Länder',
    icon: Globe,
    maxRows: 10,
    shares: s => breakdownShares(s, 'countryBreakdown'),
    marker: name => <CountryFlag name={name} />,
  },
];
