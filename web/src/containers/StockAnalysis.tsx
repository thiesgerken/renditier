import { connect } from 'react-redux';
import type { ConnectedProps } from 'react-redux';
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
} from '@mui/material';
import { styled } from '@mui/material/styles';
import Alert from '@mui/material/Alert';
import moment from 'moment';

import {
  updateStocks as updateStocksAction,
  updatePerformance as updatePerformanceAction,
} from '../actions/api';
import { updateStockPlot as updateStockPlotAction } from '../actions/stockPlot';
import { findStock, capitalizeTitle } from '../selectors/stocks';
import StockPerformanceTable from '../components/stockAnalysis/StockPerformanceTable';
import OnvistaButton from '../components/OnvistaButton';
import Hidden from '../components/Hidden';
import TransactionsTable from '../components/stockAnalysis/TransactionsTable';
import StockPlot from '../components/stockAnalysis/StockPlot';
import HoldingsPie from '../components/stockAnalysis/HoldingsPie';
import BreakdownPie from '../components/stockAnalysis/BreakdownPie';

import type { StockPerformancePeriod } from '../components/stockAnalysis/StockPerformanceRow';
import type {
  DataSource,
  DataSourceSelection,
  EitherPrice,
  IsoDate,
  StockBreakdownEntry,
  StockHolding,
} from '../types/api';
import type { AppDispatch } from '../types/actions';
import type { ResourceState, RootState } from '../types/store';

const StyledListItem = styled(ListItem)({
  height: '2em',
});

type Props = ConnectedProps<typeof connector> & {
  isin: string;
};

const StockAnalysis = ({
  isin,
  stocks,
  updateStocks,
  stockPlotData,
  updateStockPlotData,
  performance,
  updatePerformance,
}: Props) => {
  const theme = useTheme();
  const xsDown = useMediaQuery(theme.breakpoints.down('sm'));

  const formatAmount = (
    value: number | null,
    precision?: number,
    unit?: string
  ) =>
    value === null
      ? '\u2014'
      : `${value.toFixed(Number.isInteger(precision) ? precision : 2)}${
          unit === undefined ? '€' : unit
        }`;

  const formatDataSource = (dataSource: DataSource<EitherPrice> | null) => {
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
    currentPriceInfo = `Aktueller Kurs: ${formatDataSource(currentPrice)}`;

  const transactions = totalPerformance ? totalPerformance.transactions : [];
  const transactionVolume = sumBy(transactions, t => Math.abs(t.amount));
  const transactionFees = sumBy(transactions, t => Math.abs(t.fees));
  const firstTransaction = min(map(transactions, t => moment(t.date)));
  const lastTransaction = max(map(transactions, t => moment(t.date)));

  let transactionInfo;
  // lodash min/max are undefined exactly when there are no transactions, which
  // is the `transactions.length === 0` test this replaces, but narrowing.
  if (firstTransaction === undefined || lastTransaction === undefined)
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

  // These four columns hold onvista's JSON verbatim; see types/api.ts.
  const holdings: StockHolding[] =
    stock.holdings !== null ? JSON.parse(stock.holdings) : [];
  const industryBreakdown: StockBreakdownEntry[] =
    stock.industryBreakdown !== null ? JSON.parse(stock.industryBreakdown) : [];
  const currencyBreakdown: StockBreakdownEntry[] =
    stock.currencyBreakdown !== null ? JSON.parse(stock.currencyBreakdown) : [];
  const countryBreakdown: StockBreakdownEntry[] =
    stock.countryBreakdown !== null ? JSON.parse(stock.countryBreakdown) : [];
  // const instrumentBreakdown = stock.instrumentBreakdown !== null ? JSON.parse(stock.instrumentBreakdown) : [];

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
                          Auflagedatum: {moment(stock.launchDate).format('L')}
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
                        {`Transaktionsvolumen: ${formatAmount(
                          transactionVolume / 100
                        )}; dazu ${formatAmount(
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
                          {`Kosten: ${(stock.ter * 100).toFixed(2)}% p.a.`}
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
      <Hidden xsDown>
        {(holdings.length > 0 ||
          industryBreakdown.length > 0 ||
          currencyBreakdown.length > 0 ||
          countryBreakdown.length > 0) && (
          <Grid size={12} style={{ padding: theme.spacing(1) }}>
            <Container maxWidth="xl" style={{ padding: '0px' }}>
              <Paper style={{ width: '100%', padding: theme.spacing(1) }}>
                <Grid container style={{ width: '100%' }}>
                  {holdings.length > 0 && (
                    <Grid size={{ xs: 12, xl: 6 }}>
                      <HoldingsPie holdings={holdings} />
                    </Grid>
                  )}
                  {industryBreakdown.length > 0 && (
                    <Grid size={{ xs: 12, xl: 6 }}>
                      <BreakdownPie breakdown={industryBreakdown} />
                    </Grid>
                  )}
                  {currencyBreakdown.length > 0 && (
                    <Grid size={{ xs: 12, xl: 6 }}>
                      <BreakdownPie breakdown={currencyBreakdown} />
                    </Grid>
                  )}
                  {countryBreakdown.length > 0 && (
                    <Grid size={{ xs: 12, xl: 6 }}>
                      <BreakdownPie breakdown={countryBreakdown} />
                    </Grid>
                  )}
                  {/* {instrumentBreakdown.length > 0 && (
                <Grid item xs={12} xl={4}>
                  <BreakdownPie breakdown={instrumentBreakdown} />
                </Grid>
              )} */}
                </Grid>
              </Paper>
            </Container>
          </Grid>
        )}
      </Hidden>
    </Grid>
  );
};

const mapDispatchToProps = (dispatch: AppDispatch) => ({
  updatePerformance: () => dispatch(updatePerformanceAction()),
  updateStocks: () => dispatch(updateStocksAction()),
  updateStockPlotData: (
    isin: string | null,
    startDate: IsoDate | null,
    endDate: IsoDate | null,
    source: DataSourceSelection | null
  ) => dispatch(updateStockPlotAction(isin, startDate, endDate, source)),
});

const mapStateToProps = (state: RootState) => {
  const { performance, stocks, stockPlot } = state;

  return {
    performance,
    stocks,
    stockPlotData: stockPlot.items,
  };
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export default connector(StockAnalysis);
