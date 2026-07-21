import { Container, Grid } from '@mui/material';
import { map, forEach } from 'lodash';

import type {
  PortfolioPerformance,
  StockBreakdownEntry,
  StockHolding,
} from '../../types/api';
import type { PerformanceState, StocksState } from '../../types/store';
import ProgressPaper from '../ProgressPaper';
import { findStock } from '../../selectors/stocks';
import BreakdownPie from '../stockAnalysis/BreakdownPie';
import HoldingsPie from '../stockAnalysis/HoldingsPie';

// The `Stock` columns that carry a StockBreakdownEntry[] encoded as a JSON string.
type BreakdownKind =
  | 'industryBreakdown'
  | 'instrumentBreakdown'
  | 'countryBreakdown'
  | 'currencyBreakdown';

const accumulateBreakdowns = (
  stocks: StocksState | null,
  performance: PortfolioPerformance | null,
  breakKind: BreakdownKind,
  nameFormatter?: (name: string) => string
): StockBreakdownEntry[] | null => {
  if (stocks === null || performance === null) return null;
  const result: Record<string, number> = {};
  // Bound outside the callback so the null-check above survives into it.
  const totalInvested = performance.end.invested;

  forEach(performance.positions, (p, isin) => {
    const stock = findStock(stocks, isin);

    if (stock !== null) {
      const raw = stock[breakKind];

      const data = map(
        // The column is a JSON *string* on the wire and the backend stores
        // onvista's payload verbatim, so JSON.parse yields `unknown`; types/api
        // declares the entry shape it is known to hold.
        raw !== null ? (JSON.parse(raw) as StockBreakdownEntry[]) : [],
        x => ({
          nameBreakdown: nameFormatter
            ? nameFormatter(x.nameBreakdown)
            : x.nameBreakdown,
          investmentPct: x.investmentPct,
        })
      );

      forEach(data, x => {
        if (!(x.nameBreakdown in result)) result[x.nameBreakdown] = 0;
        result[x.nameBreakdown] +=
          (-1 * p.end.invested * x.investmentPct) / 100 / totalInvested;
      });
    }
  });

  return map(result, (v, k) => ({ nameBreakdown: k, investmentPct: -100 * v }));
};

const accumulateHoldings = (
  stocks: StocksState | null,
  performance: PortfolioPerformance | null,
  nameFormatter?: (name: string) => string
): StockHolding[] | null => {
  if (stocks === null || performance === null) return null;
  const result: Record<string, number> = {};
  const totalInvested = performance.end.invested;

  forEach(performance.positions, (p, isin) => {
    const stock = findStock(stocks, isin);

    if (stock !== null) {
      const data = map(
        // Same as above: `holdings` is a JSON string holding a StockHolding[].
        stock.holdings !== null
          ? (JSON.parse(stock.holdings) as StockHolding[])
          : [{ instrument: { name: stock.title }, investmentPct: 100.0 }],
        x => ({
          instrument: {
            name: nameFormatter
              ? nameFormatter(x.instrument.name)
              : x.instrument.name,
          },
          investmentPct: x.investmentPct,
        })
      );

      forEach(data, x => {
        if (!(x.instrument.name in result)) result[x.instrument.name] = 0;
        result[x.instrument.name] +=
          (-1 * p.end.invested * x.investmentPct) / totalInvested;
      });
    }
  });

  return map(result, (v, k) => ({
    instrument: { name: k },
    investmentPct: -1 * v,
  }));
};

interface Props {
  performance: PerformanceState;
  stocks: StocksState;
}

const Breakdowns = ({ stocks, performance }: Props) => {
  // The accumulators only return null when `stocks` or the period is null,
  // which cannot happen below, so the `?? []` branches are never taken.
  let industryBreakdown: StockBreakdownEntry[] = [];
  let currencyBreakdown: StockBreakdownEntry[] = [];
  let countryBreakdown: StockBreakdownEntry[] = [];
  // let instrumentBreakdown = [];
  let holdings: StockHolding[] = [];

  if (performance.data !== null && performance.data.length > 0) {
    // TODO: customize the index of the performance (dropdown?)
    const p = performance.data[0];

    industryBreakdown =
      accumulateBreakdowns(stocks, p, 'industryBreakdown') ?? [];
    currencyBreakdown =
      accumulateBreakdowns(stocks, p, 'currencyBreakdown') ?? [];
    countryBreakdown =
      accumulateBreakdowns(stocks, p, 'countryBreakdown', name => {
        if (
          name === 'Vereinigte Staaten' ||
          name === 'Vereinigte Staaten von Amerika'
        )
          return 'USA';
        return name;
      }) ?? [];
    // instrumentBreakdown = accumulateBreakdowns(
    //   stocks,
    //   p,
    //   'instrumentBreakdown'
    // );
    holdings = accumulateHoldings(stocks, p) ?? [];
  }

  return (
    <Container maxWidth="xl" style={{ padding: '0px' }}>
      <ProgressPaper loading={stocks.isFetching || performance.isFetching}>
        <Grid container>
          <Grid size={{ xs: 12, md: 6 }}>
            <HoldingsPie holdings={holdings} />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <BreakdownPie breakdown={industryBreakdown} />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <BreakdownPie breakdown={currencyBreakdown} />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <BreakdownPie breakdown={countryBreakdown} />
          </Grid>
          {/* <Grid item xs={12} md={6}>
            <BreakdownPie breakdown={instrumentBreakdown} />
          </Grid> */}
        </Grid>
      </ProgressPaper>
    </Container>
  );
};

export default Breakdowns;
