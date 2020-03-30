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
  List,
  ListItem,
  Typography,
  useMediaQuery,
  withStyles,
  Hidden,
} from '@material-ui/core';
import Alert from '@material-ui/lab/Alert';
import * as moment from 'moment';

import { updateStocks as updateStocksAction } from '../actions/stocks';
import { updatePerformance as updatePerformanceAction } from '../actions/performance';
import { updateStockPlot as updateStockPlotAction } from '../actions/stockPlot';
import { findStock, capitalizeTitle } from '../selectors/stocks';
import StockPerformanceTable from '../components/StockPerformanceTable';
import OnvistaButton from '../components/OnvistaButton';
import TransactionsTable from '../components/TransactionsTable';
import StockPlot from '../components/StockPlot';

const StockAnalysis = ({
  isin,
  stocks,
  updateStocks,
  stockPlotData,
  updateStockPlotData,
  performance,
  updatePerformance,
}) => {
  const theme = useTheme();
  const xsDown = useMediaQuery(theme.breakpoints.down('xs'));

  const formatAmount = (value, precision, unit) =>
    value === null
      ? '\u2014'
      : `${value.toFixed(Number.isInteger(precision) ? precision : 2)}${
          unit === undefined ? '€' : unit
        }`;

  const formatDataSource = dataSource => {
    if (!dataSource) return '';

    if (dataSource.price.type === 'RealtimePrice') {
      return `${formatAmount(dataSource.price.price)} (am ${moment(
        dataSource.price.date
      ).format('L [um] LT')} bei ${dataSource.exchange.name})`;
    }

    return `${formatAmount(dataSource.price.closing)} (am ${moment(
      dataSource.price.date
    ).format('L')} bei ${dataSource.exchange.name})`;
  };

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

  const todayPerformance = find(
    stockPerformance.items,
    p => p.kind === 'Today'
  );
  const currentPrice = todayPerformance.end.dataSource;
  let currentPriceInfo;
  if (currentPrice !== null)
    currentPriceInfo = `Aktueller Kurs: ${formatDataSource(currentPrice)}`;

  const { transactions } = totalPerformance;
  const transactionVolume = sumBy(transactions, t => Math.abs(t.amount));
  const transactionFees = sumBy(transactions, t => Math.abs(t.fees));
  const firstTransaction = min(map(transactions, t => moment(t.date)));
  const lastTransaction = max(map(transactions, t => moment(t.date)));

  // TODO: plot with historical data, mark the transactions (switch to realtime data at some resolution?)

  let transactionInfo;
  if (transactions.length === 0)
    transactionInfo = 'Transaktionen: bisher nicht gehandelt';
  else if (transactions.length === 1)
    transactionInfo = `Transaktionen: eine, getätigt am ${firstTransaction.format(
      'L [um] LT [Uhr]'
    )}`;
  else
    transactionInfo = `Transaktionen: ${
      transactions.length
    }, getätigt im Zeitraum von ${firstTransaction.format(
      'L'
    )} bis ${lastTransaction.format('L')}`;

  let typeInfo;
  if (stock.kind === 'ETF')
    typeInfo = `Typ: ${stock.kind} (${stock.fondsType}) mit Fokus auf ${stock.focus}`;
  else typeInfo = `Typ: ${stock.kind}`;

  const StyledListItem = withStyles(() => ({
    root: {
      height: '2em',
    },
  }))(ListItem);

  return (
    <Grid container spacing={3}>
      <Grid item xs={12} style={{ padding: theme.spacing(1) }}>
        <Container maxWidth="lg" style={{ padding: '0px' }}>
          <Paper>
            <Grid container style={{ margin: '0px' }}>
              <Grid
                item
                xs={12}
                style={{
                  width: '100%',
                  textAlign: 'center',
                  padding: theme.spacing(2),
                }}
              >
                <Typography variant="h5">
                  {capitalizeTitle(stock.title)}
                </Typography>
              </Grid>
              {xsDown && (
                <Grid item xs={12} md={6}>
                  <List>
                    <ListItem>
                      {`ISIN: ${stock.isin}, WKN: ${stock.wkn}`}
                      <OnvistaButton relativeUrl={stock.onvistaUrl} />
                    </ListItem>
                    <ListItem>{typeInfo}</ListItem>
                    <ListItem>{`Herausgeber: ${stock.company}`}</ListItem>
                    <ListItem>{transactionInfo}</ListItem>
                    <ListItem>
                      {`Transaktionsvolumen: ${formatAmount(
                        transactionVolume / 100
                      )}; dazu ${formatAmount(
                        transactionFees / 100
                      )} an Gebühren`}
                    </ListItem>
                  </List>
                </Grid>
              )}
              {xsDown || (
                <>
                  <Grid item xs={12} md={6}>
                    <List>
                      <StyledListItem>
                        {`ISIN: ${stock.isin}, WKN: ${stock.wkn}`}
                        <OnvistaButton relativeUrl={stock.onvistaUrl} />
                      </StyledListItem>
                      <StyledListItem>{typeInfo}</StyledListItem>
                      <StyledListItem>{`Herausgeber: ${stock.company}`}</StyledListItem>
                    </List>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <List>
                      <StyledListItem>{transactionInfo}</StyledListItem>
                      <StyledListItem>
                        {`Transaktionsvolumen: ${formatAmount(
                          transactionVolume / 100
                        )}; dazu ${formatAmount(
                          transactionFees / 100
                        )} an Gebühren`}
                      </StyledListItem>
                      {currentPrice !== null && (
                        <StyledListItem>{currentPriceInfo}</StyledListItem>
                      )}
                    </List>
                  </Grid>
                </>
              )}
            </Grid>
          </Paper>
        </Container>
      </Grid>
      <Hidden xsDown implementation="js">
        <Grid item xs={12} style={{ padding: theme.spacing(1) }}>
          <StockPlot
            isin={isin}
            data={stockPlotData}
            updateData={updateStockPlotData}
            performance={performance}
          />
        </Grid>
      </Hidden>
      <Grid item xs={12} style={{ padding: theme.spacing(1) }}>
        <StockPerformanceTable performance={stockPerformance} />
      </Grid>
      <Grid item xs={12} style={{ padding: theme.spacing(1) }}>
        <TransactionsTable
          transactions={transactions}
          currentPrice={currentPrice}
        />
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
  stockPlotData: PropTypes.arrayOf(PropTypes.object).isRequired,
  updateStockPlotData: PropTypes.func.isRequired,
};

const mapDispatchToProps = dispatch => ({
  updatePerformance: () => dispatch(updatePerformanceAction()),
  updateStocks: () => dispatch(updateStocksAction()),
  updateStockPlotData: (isin, startDate, endDate, source) =>
    dispatch(updateStockPlotAction(isin, startDate, endDate, source)),
});

const mapStateToProps = state => {
  const { performance, stocks, stockPlot } = state;

  return {
    performance,
    stocks,
    stockPlotData: stockPlot.items,
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(StockAnalysis);
