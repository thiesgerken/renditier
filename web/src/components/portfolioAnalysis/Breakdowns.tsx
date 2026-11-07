import { Container, Grid } from '@mui/material';
import { find, forEach, sumBy } from 'lodash';

import type { PortfolioPerformance, Stock } from '../../types/api';
import type { PerformanceState, StocksState } from '../../types/store';
import ProgressPaper from '../ProgressPaper';
import BarList from '../BarList';
import type { BarItem } from '../BarList';
import { formatCurrency } from '../../format';
import {
  breakdownShares,
  findStock,
  holdingShares,
} from '../../selectors/stocks';
import type { FundShare } from '../../selectors/stocks';

// Below this fraction of the invested amount, an unattributed rest is rounding
// in the fund data rather than missing data.
const ROUNDING_SLACK = 0.01;

interface Breakdown {
  items: BarItem[];
  unattributed: number;
}

// Splits the invested amount of every position that is still held along the
// shares of its fund, and adds up equal names across funds.
const breakdown = (
  stocks: StocksState,
  period: PortfolioPerformance,
  shares: (stock: Stock) => FundShare[]
): Breakdown => {
  const amounts = new Map<string, number>();
  let invested = 0;

  forEach(period.positions, (p, isin) => {
    const stock = findStock(stocks, isin);
    if (stock === null || Math.abs(p.end.units) <= 1e-8) return;

    const positionInvested = -p.end.invested;
    invested += positionInvested;
    shares(stock).forEach(({ label, value }) => {
      amounts.set(
        label,
        (amounts.get(label) ?? 0) + (positionInvested * value) / 100
      );
    });
  });

  const items = [...amounts].map(([label, value]) => ({ label, value }));
  const unattributed = invested - sumBy(items, 'value');

  return {
    items,
    unattributed: unattributed > ROUNDING_SLACK * invested ? unattributed : 0,
  };
};

// Ten rows show a fund's top holdings and nearly all countries; industries get
// eleven so that all GICS sectors fit; currencies beyond the top five are
// noise.
const LISTS = [
  { title: 'Einzeltitel', maxRows: 10, shares: holdingShares },
  {
    title: 'Branchen',
    maxRows: 11,
    shares: (s: Stock) => breakdownShares(s, 'industryBreakdown'),
  },
  {
    title: 'Währungen',
    maxRows: 5,
    shares: (s: Stock) => breakdownShares(s, 'currencyBreakdown'),
  },
  {
    title: 'Länder',
    maxRows: 10,
    shares: (s: Stock) => breakdownShares(s, 'countryBreakdown'),
  },
];

interface Props {
  performance: PerformanceState;
  stocks: StocksState;
}

// The portfolio's holdings, industries, currencies and countries, by invested
// amount.
const Breakdowns = ({ stocks, performance }: Props) => {
  const total = find(performance.data, p => p.kind === 'Total');

  return (
    <Container maxWidth="xl" style={{ padding: '0px' }}>
      <ProgressPaper loading={stocks.isFetching || performance.isFetching}>
        <Grid container>
          {total !== undefined &&
            LISTS.map(({ title, maxRows, shares }) => {
              const { items, unattributed } = breakdown(stocks, total, shares);
              return (
                <Grid key={title} size={{ xs: 12, md: 6 }}>
                  <BarList
                    title={title}
                    items={items}
                    maxRows={maxRows}
                    unattributed={unattributed}
                    formatValue={v => formatCurrency(v, { digits: 0 })}
                  />
                </Grid>
              );
            })}
        </Grid>
      </ProgressPaper>
    </Container>
  );
};

export default Breakdowns;
