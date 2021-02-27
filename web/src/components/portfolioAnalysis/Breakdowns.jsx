import { Container, Grid } from '@material-ui/core';
import PropTypes from 'prop-types';
import React from 'react';
import { map, forEach } from 'lodash';

import ProgressPaper from '../ProgressPaper';
import { findStock } from '../../selectors/stocks';
import BreakdownPie from '../stockAnalysis/BreakdownPie';
import HoldingsPie from '../stockAnalysis/HoldingsPie';

const accumulateBreakdowns = (
  stocks,
  performance,
  breakKind,
  nameFormatter
) => {
  if (stocks === null || performance === null) return null;
  const result = {};

  forEach(performance.positions, (p, isin) => {
    const stock = findStock(stocks, isin);

    if (stock !== null) {
      const data = map(
        stock[breakKind] !== null ? JSON.parse(stock[breakKind]) : [],
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
          (-1 * p.end.invested * x.investmentPct) /
          100 /
          performance.end.invested;
      });
    }
  });

  return map(result, (v, k) => ({ nameBreakdown: k, investmentPct: -100 * v }));
};

const accumulateHoldings = (stocks, performance, nameFormatter) => {
  if (stocks === null || performance === null) return null;
  const result = {};

  forEach(performance.positions, (p, isin) => {
    const stock = findStock(stocks, isin);

    if (stock !== null) {
      const data = map(
        stock.holdings !== null
          ? JSON.parse(stock.holdings)
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
          (-1 * p.end.invested * x.investmentPct) / performance.end.invested;
      });
    }
  });

  return map(result, (v, k) => ({
    instrument: { name: k },
    investmentPct: -1 * v,
  }));
};

const Breakdowns = ({ stocks, performance }) => {
  let industryBreakdown = [];
  let currencyBreakdown = [];
  let countryBreakdown = [];
  // let instrumentBreakdown = [];
  let holdings = [];

  if (performance.data !== null && performance.data.length > 0) {
    // TODO: customize the index of the performance (dropdown?)
    const p = performance.data[0];

    industryBreakdown = accumulateBreakdowns(stocks, p, 'industryBreakdown');
    currencyBreakdown = accumulateBreakdowns(stocks, p, 'currencyBreakdown');
    countryBreakdown = accumulateBreakdowns(
      stocks,
      p,
      'countryBreakdown',
      name => {
        if (
          name === 'Vereinigte Staaten' ||
          name === 'Vereinigte Staaten von Amerika'
        )
          return 'USA';
        return name;
      }
    );
    // instrumentBreakdown = accumulateBreakdowns(
    //   stocks,
    //   p,
    //   'instrumentBreakdown'
    // );
    holdings = accumulateHoldings(stocks, p);
  }

  return (
    <Container maxWidth="xl" style={{ padding: '0px' }}>
      <ProgressPaper loading={stocks.isFetching || performance.isFetching}>
        <Grid container>
          <Grid item xs={12} md={6}>
            <HoldingsPie holdings={holdings} />
          </Grid>
          <Grid item xs={12} md={6}>
            <BreakdownPie breakdown={industryBreakdown} />
          </Grid>
          <Grid item xs={12} md={6}>
            <BreakdownPie breakdown={currencyBreakdown} />
          </Grid>
          <Grid item xs={12} md={6}>
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

Breakdowns.propTypes = {
  performance: PropTypes.shape({
    data: PropTypes.arrayOf(PropTypes.object),
    isFetching: PropTypes.bool,
  }).isRequired,
  stocks: PropTypes.shape({
    data: PropTypes.arrayOf(PropTypes.object),
    isFetching: PropTypes.bool,
  }).isRequired,
};

export default Breakdowns;
