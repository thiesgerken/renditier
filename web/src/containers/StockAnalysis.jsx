import { connect } from 'react-redux';
import React from 'react';
import PropTypes from 'prop-types';
import { map, filter, find, sumBy, min, max } from 'lodash';
import {
  useTheme,
  Grid,
  CircularProgress,
  Container,
  Paper,
} from '@material-ui/core';
import Alert from '@material-ui/lab/Alert';
import * as moment from 'moment';

import { updateStocks as updateStocksAction } from '../actions/stocks';
import { updatePerformance as updatePerformanceAction } from '../actions/performance';
import { findStock } from '../selectors/stocks';
import StockPerformanceTable from '../components/StockPerformanceTable';

const StockAnalysis = ({
  isin,
  stocks,
  updateStocks,
  performance,
  updatePerformance,
}) => {
  const theme = useTheme();

  const formatAmount = (value, precision, unit) =>
    value === null
      ? '\u2014'
      : `${value.toFixed(Number.isInteger(precision) ? precision : 2)}${
          unit === undefined ? '€' : unit
        }`;

  updatePerformance();
  updateStocks();

  const stock = findStock(stocks, isin);
  if (stock === null || performance.items.length === 0) {
    if (stocks.isFetching || performance.isFetching) {
      return (
        <Container maxWidth="lg">
          <div
            style={{
              position: 'relative',
              left: '50%',
              transform: 'translate(0%, 50%)',
              width: '100%',
              height: '13em',
              padding: '20px',
            }}
          >
            <CircularProgress color="secondary" />
          </div>
        </Container>
      );
    }

    return (
      <Container maxWidth="lg">
        <Alert elevation={5} variant="filled" severity="error">
          {stock === null &&
            `Die Datenbank enthält kein Wertpapier mit ISIN '${isin}'!`}
          {performance.items === null && `Keine Performance-Daten verfügbar!`}
        </Alert>
      </Container>
    );
  }

  const stockPerformance = { ...performance };
  stockPerformance.items = filter(
    map(performance.items, item => {
      const pos = item.positions[isin];
      if (pos === undefined) return null;

      return { kind: item.kind, ...pos };
    }),
    x => x !== null
  );

  const totalPerformance = find(
    stockPerformance.items,
    p => p.kind === 'Total'
  );

  const { transactions } = totalPerformance;
  const transactionVolume = sumBy(transactions, t => Math.abs(t.amount));
  const transactionFees = sumBy(transactions, t => Math.abs(t.fees));
  const firstTransaction = min(map(transactions, t => moment(t.date)));
  const lastTransaction = max(map(transactions, t => moment(t.date)));

  // TODO: Formatting of General information
  // TODO: table for all transactions (and how they performed? what about sales?)
  // TODO: plot with historical data, mark the transactions (switch to realtime data at some resolution?)

  return (
    <Grid container spacing={3}>
      <Grid item xs={12} style={{ padding: theme.spacing(1) }}>
        <Container maxWidth="lg">
          <Paper>
            <Grid container>
              <Grid item xs={12}>
                {stock.title}
              </Grid>
              <Grid item xs={12}>
                ISIN: {stock.isin}
              </Grid>
              <Grid item xs={12}>
                WKN: {stock.wkn}
              </Grid>
              <Grid item xs={12}>
                {`Typ: ${stock.kind} (${stock.fondsType}) mit Fokus auf ${stock.focus}`}
              </Grid>
              <Grid item xs={12}>
                Herausgeber: {stock.company}
              </Grid>
              <Grid item xs={12}>
                Transaktionen: {transactions.length}
                {transactions.length > 0 && (
                  <>
                    , im Zeitraum von {firstTransaction.format('L LT')}
                    bis {lastTransaction.format('L LT')}
                  </>
                )}
              </Grid>
              <Grid item xs={12}>
                Transaktionsvolumen: {formatAmount(transactionVolume / 100)}
              </Grid>
              <Grid item xs={12}>
                bezahlte Gebühren: {formatAmount(transactionFees / 100)}
              </Grid>
            </Grid>
          </Paper>
        </Container>
      </Grid>
      {/* <Hidden xsDown implementation="js">
        <Grid item xs={12} style={{ padding: theme.spacing(1) }}>
          <PortfolioPlot
            data={portfolioPlotData}
            updateData={updatePortfolioPlotData}
            performance={performance}
          />
        </Grid>
      </Hidden> */}
      <Grid item xs={12} style={{ padding: theme.spacing(1) }}>
        <StockPerformanceTable performance={stockPerformance} />
      </Grid>
    </Grid>
  );
};

StockAnalysis.propTypes = {
  isin: PropTypes.string.isRequired,
  stocks: PropTypes.shape({
    items: PropTypes.arrayOf(PropTypes.object),
    isFetching: PropTypes.bool,
    lastUpdated: PropTypes.number,
  }).isRequired,
  updateStocks: PropTypes.func.isRequired,
  performance: PropTypes.shape({
    items: PropTypes.arrayOf(PropTypes.object),
    isFetching: PropTypes.bool,
    lastUpdated: PropTypes.number,
  }).isRequired,
  updatePerformance: PropTypes.func.isRequired,
};

const mapDispatchToProps = dispatch => ({
  updatePerformance: () => dispatch(updatePerformanceAction()),
  updateStocks: () => dispatch(updateStocksAction()),
});

const mapStateToProps = state => {
  const { performance, stocks } = state;

  return {
    performance,
    stocks,
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(StockAnalysis);
