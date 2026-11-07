import { useCallback, useEffect } from 'react';
import { map, filter, find, sumBy } from 'lodash';
import { CircleAlert, LoaderCircle } from 'lucide-react';

import { fetchPerformance } from '../slices/performance';
import { fetchStocks } from '../slices/stocks';
import { updateStockPlot } from '../slices/stockPlot';
import { capitalizeTitle, findStock } from '../selectors/stocks';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatPercent,
  formatPriceSource,
} from '../format';
import StockPerformanceTable from '../components/stockAnalysis/StockPerformanceTable';
import OnvistaButton from '../components/OnvistaButton';
import TransactionsTable from '../components/stockAnalysis/TransactionsTable';
import StockPlot from '../components/stockAnalysis/StockPlot';
import BarList from '../components/BarList';
import { BREAKDOWNS } from '../components/breakdowns';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Badge } from '../components/ui/badge';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/card';

import type { StockPerformancePeriod } from '../components/stockAnalysis/StockPerformanceTable';
import type { DataSourceSelection, IsoDate } from '../types/api';
import { useAppDispatch, useAppSelector } from '../store';
import type { ResourceState } from '../types/store';

interface Props {
  isin: string;
}

const StockAnalysis = ({ isin }: Props) => {
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
  if (stocks.isFetching || performance.isFetching)
    return (
      <div className="flex h-52 items-center justify-center">
        <LoaderCircle
          aria-label="Lädt"
          className="size-6 animate-spin text-muted-foreground"
        />
      </div>
    );

  if (stock === null || performance.data === null)
    return (
      <Alert variant="destructive" className="mx-auto max-w-(--breakpoint-lg)">
        <CircleAlert />
        <AlertDescription>
          {stock === null
            ? `Die Datenbank enthält kein Wertpapier mit ISIN '${isin}'.`
            : 'Keine Performance-Daten verfügbar.'}
        </AlertDescription>
      </Alert>
    );

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

  const transactions = totalPerformance ? totalPerformance.transactions : [];
  const dates = transactions
    .map(t => Temporal.Instant.from(t.date))
    .sort(Temporal.Instant.compare);
  const first = dates.at(0);
  const last = dates.at(-1);

  let transactionInfo;
  if (first === undefined || last === undefined)
    transactionInfo = 'bisher keine';
  else if (dates.length === 1)
    transactionInfo = `eine, am ${formatDateTime(first)}`;
  else
    transactionInfo = `${dates.length}, vom ${formatDate(first)} bis ${formatDate(last)}`;

  const volume = sumBy(transactions, t => Math.abs(t.amount)) / 100;
  const fees = sumBy(transactions, t => Math.abs(t.fees)) / 100;

  // what onvista knows about the stock, then what the portfolio did with it;
  // facts onvista does not have are left out
  const facts: [string, string | null][] = [
    ['Fondstyp', stock.fondsType],
    ['Fokus', stock.focus],
    ['Herausgeber', stock.company],
    ['Index', stock.index],
    ['Währung', stock.currency],
    ['Auflagedatum', stock.launchDate && formatDate(stock.launchDate)],
    ['Ausschüttung', stock.payoutType],
    ['Kosten', stock.ter === null ? null : `${formatPercent(stock.ter)} p.a.`],
    ['Kurs', currentPrice && formatPriceSource(currentPrice)],
    ['Transaktionen', transactionInfo],
    [
      'Volumen',
      `${formatCurrency(volume)}, dazu ${formatCurrency(fees)} Gebühren`,
    ],
  ];

  const compositions = BREAKDOWNS.map(b => ({
    ...b,
    items: b.shares(stock) ?? [],
  })).filter(b => b.items.length > 0);

  return (
    <div className="mx-auto flex max-w-(--breakpoint-xl) flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {capitalizeTitle(stock.title)}
          </CardTitle>
          <CardDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Badge variant="secondary">{stock.kind}</Badge>
            <span>ISIN {stock.isin}</span>
            <span>WKN {stock.wkn}</span>
          </CardDescription>
          <CardAction>
            <OnvistaButton relativeUrl={stock.onvistaUrl} />
          </CardAction>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-8 gap-y-1.5 text-sm sm:grid-cols-2">
            {facts.map(
              ([term, value]) =>
                value !== null && (
                  <div key={term} className="grid grid-cols-[8rem_1fr] gap-2">
                    <dt className="text-muted-foreground">{term}</dt>
                    <dd>{value}</dd>
                  </div>
                )
            )}
          </dl>
        </CardContent>
      </Card>

      <StockPlot
        isin={isin}
        transactions={transactions}
        data={stockPlotData}
        updateData={updateStockPlotData}
        performance={performance}
      />

      <StockPerformanceTable performance={stockPerformance} />

      <Card>
        <CardHeader>
          <CardTitle>Transaktionen</CardTitle>
        </CardHeader>
        <CardContent>
          <TransactionsTable
            transactions={transactions}
            currentPrice={currentPrice}
          />
        </CardContent>
      </Card>

      {compositions.length > 0 && (
        <Card>
          <CardContent className="grid gap-6 md:grid-cols-2">
            {compositions.map(({ title, icon, maxRows, items, marker }) => (
              <BarList
                key={title}
                title={title}
                icon={icon}
                marker={marker}
                items={items}
                maxRows={maxRows}
                total={100}
              />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default StockAnalysis;
