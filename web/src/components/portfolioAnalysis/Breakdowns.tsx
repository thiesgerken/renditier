import { Container, Grid, Typography } from '@mui/material';
import { find, map, partition, sumBy } from 'lodash';

import type { PortfolioPerformance, Stock } from '../../types/api';
import type { PerformanceState, StocksState } from '../../types/store';
import ProgressPaper from '../ProgressPaper';
import BarList from '../BarList';
import type { BarItem } from '../BarList';
import { formatCurrency } from '../../format';
import { isHeld } from '../../selectors/performance';
import {
  breakdownShares,
  capitalizeTitle,
  findStock,
  holdingShares,
} from '../../selectors/stocks';
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
  const amounts = new Map<string, number>();
  positions.forEach(({ stock, invested }) => {
    shares(stock).forEach(({ label, value }) => {
      amounts.set(label, (amounts.get(label) ?? 0) + (invested * value) / 100);
    });
  });
  return [...amounts].map(([label, value]) => ({ label, value }));
};

// Ten rows show a fund's top holdings and nearly all countries; industries get
// eleven so that all GICS sectors fit; currencies beyond the top five are
// noise.
const LISTS = [
  {
    title: 'Einzeltitel',
    maxRows: 10,
    // a stock without holdings data, e.g. a share, is its own single holding
    shares: (s: Stock) => holdingShares(s) ?? [{ label: s.title, value: 100 }],
  },
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
  // A held position with no positive net cost (more taken out than paid in)
  // has no share of the invested amount to split; spreading its negative
  // amount over its fund's names would silently net it against other funds.
  const [invested, drawnDown] = partition(
    total === undefined ? [] : heldPositions(stocks, total),
    p => p.invested > 0
  );

  return (
    <Container maxWidth="xl" style={{ padding: '0px' }}>
      <ProgressPaper loading={stocks.isFetching || performance.isFetching}>
        <Grid container>
          {LISTS.map(({ title, maxRows, shares }) => (
            <Grid key={title} size={{ xs: 12, md: 6 }}>
              <BarList
                title={title}
                items={breakdown(invested, shares)}
                maxRows={maxRows}
                total={sumBy(invested, 'invested')}
                formatValue={v => formatCurrency(v, { digits: 0 })}
              />
            </Grid>
          ))}
        </Grid>
        {drawnDown.length > 0 && (
          <Typography
            variant="caption"
            component="p"
            sx={{ p: 1, color: 'text.secondary' }}
          >
            Mehr entnommen als eingezahlt, daher nicht enthalten:{' '}
            {drawnDown.map(p => capitalizeTitle(p.stock.title)).join(', ')}
          </Typography>
        )}
      </ProgressPaper>
    </Container>
  );
};

export default Breakdowns;
