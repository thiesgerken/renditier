import { map, partition, sumBy } from 'lodash';

import type { PortfolioPerformance, Stock } from '../../types/api';
import type { StocksState } from '../../types/store';
import ProgressCard from '../ProgressCard';
import { CardContent } from '../ui/card';
import BarList from '../BarList';
import type { BarItem } from '../BarList';
import { BREAKDOWNS } from '../breakdowns';
import { formatCurrency } from '../../format';
import { isHeld } from '../../selectors/performance';
import { capitalizeTitle, findStock } from '../../selectors/stocks';
import type { FundShare } from '../../selectors/stocks';

interface HeldPosition {
  stock: Stock;
  invested: number;
}

const heldPositions = (
  stocks: StocksState,
  period: PortfolioPerformance
): HeldPosition[] =>
  map(period.positions, (p, isin) => {
    const stock = findStock(stocks, isin);
    return stock !== null && isHeld(p)
      ? [{ stock, invested: -p.end.invested }]
      : [];
  }).flat();

// Splits the invested amount of every position along the shares of its fund,
// and adds up equal names across funds.
const breakdown = (
  positions: HeldPosition[],
  shares: (stock: Stock) => FundShare[]
): BarItem[] => {
  const items = new Map<string, BarItem>();
  positions.forEach(({ stock, invested }) => {
    shares(stock).forEach(({ label, value, isin }) => {
      const amount = (invested * value) / 100;
      items.set(label, {
        label,
        value: (items.get(label)?.value ?? 0) + amount,
        isin,
      });
    });
  });
  return [...items.values()];
};

interface Props {
  // the positions at the end of this period
  period: PortfolioPerformance | undefined;
  loading: boolean;
  stocks: StocksState;
}

// The portfolio's holdings, industries, currencies and countries, by invested
// amount.
const Breakdowns = ({ period, loading, stocks }: Props) => {
  // A held position with no positive net cost (more taken out than paid in)
  // has no share of the invested amount to split; spreading its negative
  // amount over its fund's names would silently net it against other funds.
  const [invested, drawnDown] = partition(
    period === undefined ? [] : heldPositions(stocks, period),
    p => p.invested > 0
  );

  return (
    <ProgressCard loading={loading}>
      <CardContent className="flex flex-col gap-6">
        {/* onvista only has the funds' composition of today; running periods
            end today, finished ones do not */}
        {period !== undefined &&
          (period.kind === 'YearToYear' || period.kind === 'MonthToMonth') && (
            <p className="text-xs text-muted-foreground">
              Die Zusammensetzung der Fonds (Einzeltitel, Branchen, Währungen,
              Länder) ist immer die heutige von onvista, auch für vergangene
              Zeiträume.
            </p>
          )}
        <div className="grid gap-6 md:grid-cols-2">
          {BREAKDOWNS.map(({ title, icon, maxRows, shares, marker }) => (
            <BarList
              key={title}
              title={title}
              icon={icon}
              marker={marker}
              // a stock without holdings data, e.g. a share, is its own
              // single holding
              items={breakdown(
                invested,
                s => shares(s) ?? [{ label: s.title, value: 100, isin: s.isin }]
              )}
              maxRows={maxRows}
              total={sumBy(invested, 'invested')}
              formatValue={v => formatCurrency(v, { digits: 0 })}
            />
          ))}
        </div>
        {drawnDown.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Mehr entnommen als eingezahlt, daher nicht enthalten:{' '}
            {drawnDown.map(p => capitalizeTitle(p.stock.title)).join(', ')}
          </p>
        )}
      </CardContent>
    </ProgressCard>
  );
};

export default Breakdowns;
