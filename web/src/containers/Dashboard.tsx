import { useCallback, useEffect } from 'react';
import { filter, max, min, map } from 'lodash';
import moment from 'moment';
import type { Moment } from 'moment';

import { fetchPerformance } from '../slices/performance';
import { fetchStocks } from '../slices/stocks';
import { updatePortfolioPlot } from '../slices/portfolioPlot';
import KpiHeader from '../components/portfolioAnalysis/KpiHeader';
import PeriodSelect from '../components/portfolioAnalysis/PeriodSelect';
import PerformanceTable from '../components/portfolioAnalysis/PerformanceTable';
import PortfolioPlot from '../components/portfolioAnalysis/PortfolioPlot';
import PositionsTable from '../components/portfolioAnalysis/PositionsTable';
import PositionsBars from '../components/portfolioAnalysis/PositionsBars';
import Breakdowns from '../components/portfolioAnalysis/Breakdowns';
import { formatDate, formatDateTime } from '../format';
import {
  findSelectedPeriod,
  getPeriodDescription,
  getPeriodRange,
  periodKey,
} from '../selectors/performance';

import { useAppDispatch, useAppSelector } from '../store';
import type {
  DataSourceSelection,
  IsoDate,
  PortfolioPerformance,
} from '../types/api';

// When the realtime prices behind the positions of a period were taken, as
// "from" and "to"; null when no position has a price.
const priceDates = (period: PortfolioPerformance): [string, string] | null => {
  const dates = filter(
    map(period.positions, p =>
      p.end.dataSource !== null ? moment(p.end.dataSource.price.date) : null
    ),
    (d): d is Moment => d !== null
  );
  const oldest = min(dates);
  const newest = max(dates);

  return oldest === undefined || newest === undefined
    ? null
    : [formatDateTime(oldest), formatDateTime(newest)];
};

const Dashboard = () => {
  const dispatch = useAppDispatch();
  const performance = useAppSelector(state => state.performance);
  const stocks = useAppSelector(state => state.stocks);
  const selectedKey = useAppSelector(state => state.period.selected);
  const portfolioPlotData = useAppSelector(state => state.portfolioPlot.items);
  const updatePortfolioPlotData = useCallback(
    (
      startDate: IsoDate | null,
      endDate: IsoDate | null,
      source: DataSourceSelection | null
    ) => dispatch(updatePortfolioPlot(startDate, endDate, source)),
    [dispatch]
  );

  useEffect(() => {
    dispatch(fetchPerformance());
    dispatch(fetchStocks());
  });

  const periods = performance.data ?? [];
  // The backend always sends a Total period, so this is undefined only until
  // the performance data has loaded.
  const period = findSelectedPeriod(periods, selectedKey);
  const total = periods.find(p => p.kind === 'Total');
  const hasPositions =
    total === undefined || Object.keys(total.positions).length > 0;
  const realtimeDates = total === undefined ? null : priceDates(total);
  const range = period === undefined ? null : getPeriodRange(period);

  return (
    <div className="flex flex-col gap-4">
      {/* Sticky on desktop only: on a phone, where it wraps to three rows, it
          would cover a fifth of the screen. */}
      <div className="-mx-3 flex flex-wrap items-center justify-between gap-2 px-3 py-2 md:sticky md:top-0 md:z-20 md:bg-background/90 md:backdrop-blur">
        <div>
          <h1 className="text-lg font-semibold">
            {period === undefined ? 'Übersicht' : getPeriodDescription(period)}
          </h1>
          {range !== null && (
            <p className="text-xs text-muted-foreground">
              {formatDate(range[0])} bis {formatDate(range[1])}
            </p>
          )}
        </div>
        {period !== undefined && (
          <PeriodSelect periods={periods} selected={periodKey(period)} />
        )}
      </div>

      {period !== undefined && <KpiHeader period={period} />}

      {hasPositions && (
        <div className="hidden sm:block">
          <PortfolioPlot
            data={portfolioPlotData}
            updateData={updatePortfolioPlotData}
            performance={performance}
            period={period}
          />
        </div>
      )}

      {hasPositions && (
        <PositionsTable
          period={period}
          loading={performance.isFetching}
          stocks={stocks}
        />
      )}

      <PerformanceTable
        periods={periods}
        loading={performance.isFetching}
        selected={period === undefined ? null : periodKey(period)}
      />

      {hasPositions && (
        <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
          <PositionsBars
            period={period}
            loading={performance.isFetching}
            stocks={stocks}
          />
          <Breakdowns
            period={period}
            loading={stocks.isFetching || performance.isFetching}
            stocks={stocks}
          />
        </div>
      )}

      {realtimeDates !== null && (
        <p className="px-1 text-xs text-muted-foreground">
          {`Die Performance-Berechnungen wurden ${moment(
            performance.lastRequest
          ).fromNow()} aktualisiert. Alle Echtzeit-Preisberechnungen basieren auf Daten vom`}
          {realtimeDates[0] !== realtimeDates[1]
            ? ` ${realtimeDates[0]} bis ${realtimeDates[1]}.`
            : ` ${realtimeDates[0]}.`}
        </p>
      )}
    </div>
  );
};

export default Dashboard;
