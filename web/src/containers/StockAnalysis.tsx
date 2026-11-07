import { useCallback, useEffect } from 'react';
import { map, filter, find, sumBy } from 'lodash';
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
} from '@mui/material';
import { styled } from '@mui/material/styles';
import Alert from '@mui/material/Alert';

import { fetchPerformance } from '../slices/performance';
import { fetchStocks } from '../slices/stocks';
import { updateStockPlot } from '../slices/stockPlot';
import {
  breakdownShares,
  capitalizeTitle,
  findStock,
  holdingShares,
} from '../selectors/stocks';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatPercent,
  formatPriceSource,
} from '../format';
import StockPerformanceTable from '../components/stockAnalysis/StockPerformanceTable';
import OnvistaButton from '../components/OnvistaButton';
import Hidden from '../components/Hidden';
import TransactionsTable from '../components/stockAnalysis/TransactionsTable';
import StockPlot from '../components/stockAnalysis/StockPlot';
import BarList from '../components/BarList';

import type { StockPerformancePeriod } from '../components/stockAnalysis/StockPerformanceTable';
import type { DataSourceSelection, IsoDate } from '../types/api';
import { useAppDispatch, useAppSelector } from '../store';
import type { ResourceState } from '../types/store';

const StyledListItem = styled(ListItem)({
  height: '2em',
});

interface Props {
  isin: string;
}

const StockAnalysis = ({ isin }: Props) => {
  const theme = useTheme();
  const xsDown = useMediaQuery(theme.breakpoints.down('sm'));
  const dispatch = useAppDispatch();
  const stocks = useAppSelector(state => state.stocks);
  const performance = useAppSelector(state => state.performance);
  const stockPlotData = useAppSelector(state => state.stockPlot.items);
  const updateStockPlotData = useCallback(
    (
      isin: string | null,
      startDate: IsoDate | null,
      endDate: IsoDate | null,
      source: DataSourceSelection | null
    ) => dispatch(updateStockPlot(isin, startDate, endDate, source)),
    [dispatch]
  );

  useEffect(() => {
    dispatch(fetchPerformance());
    dispatch(fetchStocks());
  });

  const stock = findStock(stocks, isin);
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

  if (stock === null || performance.data === null) {
    return (
      <Container maxWidth="lg">
        <Alert elevation={5} variant="filled" severity="error">
          {stock === null &&
            `Die Datenbank enthält kein Wertpapier mit ISIN '${isin}'!`}
          {performance.data === null && `Keine Performance-Daten verfügbar!`}
        </Alert>
      </Container>
    );
  }

  // Same slice, but every portfolio-wide period is narrowed to this ISIN's
  // position, so the element type differs from `PerformanceState`.
  const stockPerformance: ResourceState<StockPerformancePeriod[]> = {
    ...performance,
    data: filter(
      map(performance.data, item => {
        const pos = item.positions[isin];
        if (pos === undefined) return null;

        return { kind: item.kind, ...pos };
      }),
      (x): x is StockPerformancePeriod => x !== null
    ),
  };

  const totalPerformance = find(stockPerformance.data, p => p.kind === 'Total');
  const todayPerformance = find(stockPerformance.data, p => p.kind === 'Today');

  const currentPrice = todayPerformance
    ? todayPerformance.end.dataSource
    : null;
  let currentPriceInfo;
  if (currentPrice !== null)
    currentPriceInfo = `Aktueller Kurs: ${formatPriceSource(currentPrice)}`;

  const transactions = totalPerformance ? totalPerformance.transactions : [];
  const transactionVolume = sumBy(transactions, t => Math.abs(t.amount));
  const transactionFees = sumBy(transactions, t => Math.abs(t.fees));
  const dates = transactions
    .map(t => Temporal.Instant.from(t.date))
    .sort(Temporal.Instant.compare);
  const firstTransaction = dates.at(0);
  const lastTransaction = dates.at(-1);

  let transactionInfo;
  if (firstTransaction === undefined || lastTransaction === undefined)
    transactionInfo = 'Transaktionen: bisher nicht gehandelt';
  else if (transactions.length === 1)
    transactionInfo = `Transaktionen: eine, getätigt am ${formatDateTime(
      firstTransaction
    )}`;
  else
    transactionInfo = `Transaktionen: ${
      transactions.length
    }, getätigt im Zeitraum von ${formatDate(
      firstTransaction
    )} bis ${formatDate(lastTransaction)}`;

  let typeInfo;
  if (stock.kind === 'ETF')
    typeInfo = `Typ: ${stock.kind} (${stock.fondsType}) mit Fokus auf ${stock.focus}`;
  else typeInfo = `Typ: ${stock.kind}`;

  // Same row counts as the portfolio-wide lists on the dashboard.
  const compositions = [
    {
      title: 'Einzeltitel',
      maxRows: 10,
      shares: holdingShares(stock) ?? [],
    },
    {
      title: 'Branchen',
      maxRows: 11,
      shares: breakdownShares(stock, 'industryBreakdown'),
    },
    {
      title: 'Währungen',
      maxRows: 5,
      shares: breakdownShares(stock, 'currencyBreakdown'),
    },
    {
      title: 'Länder',
      maxRows: 10,
      shares: breakdownShares(stock, 'countryBreakdown'),
    },
  ].filter(c => c.shares.length > 0);

  return (
    <Grid container spacing={3}>
      <Grid size={12} style={{ padding: theme.spacing(1) }}>
        <Container maxWidth="lg" style={{ padding: '0px' }}>
          <Paper>
            <Grid container style={{ margin: '0px' }}>
              <Grid
                size={12}
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
                <Grid size={{ xs: 12, md: 6 }}>
                  <List>
                    <ListItem>
                      {`ISIN: ${stock.isin}, WKN: ${stock.wkn}`}
                      <OnvistaButton relativeUrl={stock.onvistaUrl} />
                    </ListItem>
                    <ListItem>{typeInfo}</ListItem>
                    <ListItem>{`Herausgeber: ${stock.company}`}</ListItem>
                    <ListItem>{transactionInfo}</ListItem>
                    <ListItem>
                      {`Transaktionsvolumen: ${formatCurrency(
                        transactionVolume / 100
                      )}; dazu ${formatCurrency(
                        transactionFees / 100
                      )} an Gebühren`}
                    </ListItem>
                  </List>
                </Grid>
              )}
              {xsDown || (
                <>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <List>
                      <StyledListItem>
                        {`ISIN: ${stock.isin}, WKN: ${stock.wkn}`}
                        <OnvistaButton relativeUrl={stock.onvistaUrl} />
                      </StyledListItem>
                      <StyledListItem>{typeInfo}</StyledListItem>
                      <StyledListItem>{`Herausgeber: ${stock.company}`}</StyledListItem>
                      {stock.currency !== null && (
                        <StyledListItem>
                          Währung: {stock.currency}
                        </StyledListItem>
                      )}
                      {stock.launchDate !== null && (
                        <StyledListItem>
                          Auflagedatum: {formatDate(stock.launchDate)}
                        </StyledListItem>
                      )}{' '}
                      {stock.index !== null && (
                        <StyledListItem>Index: {stock.index}</StyledListItem>
                      )}
                    </List>
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <List>
                      <StyledListItem>{transactionInfo}</StyledListItem>
                      <StyledListItem>
                        {`Transaktionsvolumen: ${formatCurrency(
                          transactionVolume / 100
                        )}; dazu ${formatCurrency(
                          transactionFees / 100
                        )} an Gebühren`}
                      </StyledListItem>
                      {currentPrice !== null && (
                        <StyledListItem>{currentPriceInfo}</StyledListItem>
                      )}
                      {stock.payoutType !== null && (
                        <StyledListItem>
                          Auschüttungsart: {stock.payoutType}
                        </StyledListItem>
                      )}
                      {stock.ter !== null && (
                        <StyledListItem>
                          {`Kosten: ${formatPercent(stock.ter)} p.a.`}
                        </StyledListItem>
                      )}
                    </List>
                  </Grid>
                </>
              )}
            </Grid>
          </Paper>
        </Container>
      </Grid>
      <Hidden xsDown>
        <Grid size={12} style={{ padding: theme.spacing(1) }}>
          <StockPlot
            isin={isin}
            transactions={transactions}
            data={stockPlotData}
            updateData={updateStockPlotData}
            performance={performance}
          />
        </Grid>
      </Hidden>
      <Grid size={12} style={{ padding: theme.spacing(1) }}>
        <StockPerformanceTable performance={stockPerformance} />
      </Grid>
      <Grid size={12} style={{ padding: theme.spacing(1) }}>
        <TransactionsTable
          transactions={transactions}
          currentPrice={currentPrice}
        />
      </Grid>
      {compositions.length > 0 && (
        <Grid size={12} style={{ padding: theme.spacing(1) }}>
          <Container maxWidth="xl" style={{ padding: '0px' }}>
            <Paper style={{ width: '100%', padding: theme.spacing(1) }}>
              <Grid container style={{ width: '100%' }}>
                {compositions.map(({ title, maxRows, shares }) => (
                  <Grid key={title} size={{ xs: 12, md: 6 }}>
                    <BarList
                      title={title}
                      items={shares}
                      maxRows={maxRows}
                      total={100}
                    />
                  </Grid>
                ))}
              </Grid>
            </Paper>
          </Container>
        </Grid>
      )}
    </Grid>
  );
};

export default StockAnalysis;
