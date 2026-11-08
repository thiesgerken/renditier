import { useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { fetchPerformance, retryPerformance } from '../slices/performance';
import { fetchStocks, retryStocks } from '../slices/stocks';
import { updatePortfolioPlot } from '../slices/portfolioPlot';
import KpiHeader from '../components/portfolioAnalysis/KpiHeader';
import PeriodSelect from '../components/portfolioAnalysis/PeriodSelect';
import PerformanceTable from '../components/portfolioAnalysis/PerformanceTable';
import PortfolioPlot from '../components/portfolioAnalysis/PortfolioPlot';
import PositionsTable from '../components/portfolioAnalysis/PositionsTable';
import PositionsBars from '../components/portfolioAnalysis/PositionsBars';
import Breakdowns from '../components/portfolioAnalysis/Breakdowns';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../components/ui/tabs';
import { formatDate, formatDateTime, formatSince } from '../format';
import {
  findSelectedPeriod,
  getPeriodDescription,
  getPeriodRange,
  periodKey,
} from '../selectors/performance';

import { useAppDispatch, useAppSelector } from '../store';
import useLoadFailure from '../useLoadFailure';
import useMediaQuery, { DESKTOP } from '../useMediaQuery';
import useQueryParam from '../useQueryParam';
import DashboardSections from './DashboardSections';
import {
  DASHBOARD_TAB_ICONS,
  DASHBOARD_TABS,
  dashboardTabParam,
  toDashboardTab,
} from './dashboardTabs';
import type { DashboardTab } from './dashboardTabs';
import type {
  DataSourceSelection,
  EitherPrice,
  IsoDate,
  PortfolioPerformance,
} from '../types/api';

// A historical price has a day only, which counts from its start.
const priceInstant = (price: EitherPrice): Temporal.Instant =>
  price.type === 'RealtimePrice'
    ? Temporal.Instant.from(price.date)
    : Temporal.PlainDate.from(price.date)
        .toZonedDateTime(Temporal.Now.timeZoneId())
        .toInstant();

// When the prices behind the positions of a period were taken, as "from" and
// "to"; null when no position has a price.
const priceDates = (period: PortfolioPerformance): [string, string] | null => {
  const dates = Object.values(period.positions)
    .flatMap(p =>
      p.end.dataSource === null ? [] : [priceInstant(p.end.dataSource.price)]
    )
    .sort((a, b) => Temporal.Instant.compare(a, b));

  const first = dates[0];
  const last = dates.at(-1);
  return first === undefined || last === undefined
    ? null
    : [formatDateTime(first), formatDateTime(last)];
};

const Dashboard = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const performance = useAppSelector(state => state.performance);
  const stocks = useAppSelector(state => state.stocks);
  const selectedKey = useAppSelector(state => state.period.selected);
  const portfolioPlotData = useAppSelector(state => state.portfolioPlot.items);
  const [tabParam, setTab] = useQueryParam('tab', { replace: true });
  const tab = toDashboardTab(tabParam);
  const desktop = useMediaQuery(DESKTOP);
  const updatePortfolioPlotData = useCallback(
    (
      startDate: IsoDate | null,
      endDate: IsoDate | null,
      source: DataSourceSelection | null
    ) => dispatch(updatePortfolioPlot(startDate, endDate, source)),
    [dispatch]
  );

  useEffect(() => {
    void dispatch(fetchPerformance());
    void dispatch(fetchStocks());
  });
  const performanceLoad = [performance, retryPerformance()] as const;
  const performanceFailure = useLoadFailure(performanceLoad);
  const positionsFailure = useLoadFailure(performanceLoad, [
    stocks,
    retryStocks(),
  ]);

  const periods = performance.data ?? [];
  // The backend always sends a Total period, so this is undefined only until
  // the performance data has loaded.
  const period = findSelectedPeriod(periods, selectedKey);
  const total = periods.find(p => p.kind === 'Total');
  const realtimeDates = total === undefined ? null : priceDates(total);
  const range = period === undefined ? null : getPeriodRange(period);

  const sections: Record<DashboardTab, ReactNode> = {
    chart: (
      <PortfolioPlot
        data={portfolioPlotData}
        updateData={updatePortfolioPlotData}
        performance={performance}
        period={period}
      />
    ),
    positions: (
      <div className="flex flex-col gap-4">
        <PositionsTable
          period={period}
          loading={performance.isFetching}
          failure={positionsFailure}
          stocks={stocks}
        />
        <PositionsBars
          period={period}
          loading={performance.isFetching}
          failure={positionsFailure}
          stocks={stocks}
        />
      </div>
    ),
    periods: (
      <PerformanceTable
        periods={periods}
        loading={performance.isFetching}
        failure={performanceFailure}
        selected={period === undefined ? null : periodKey(period)}
      />
    ),
    composition: (
      <Breakdowns
        period={period}
        loading={stocks.isFetching || performance.isFetching}
        failure={positionsFailure}
        stocks={stocks}
      />
    ),
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Sticky on desktop only: on a phone, where it wraps to three rows, it
          would cover a fifth of the screen. */}
      <div className="-mx-3 flex flex-wrap items-center justify-between gap-2 px-3 py-2 md:sticky md:top-0 md:z-20 md:bg-background/90 md:backdrop-blur">
        <div>
          <h1 className="text-lg font-medium">
            {period === undefined
              ? t('nav.dashboard')
              : getPeriodDescription(period)}
          </h1>
          {range !== null && (
            <p className="text-xs text-muted-foreground">
              {t('dashboard.range', {
                start: formatDate(range[0]),
                end: formatDate(range[1]),
              })}
            </p>
          )}
        </div>
        {period !== undefined && (
          <PeriodSelect periods={periods} selected={periodKey(period)} />
        )}
      </div>

      {/* Old figures next to cards that say the reload failed would read as
          current. */}
      {period !== undefined && performanceFailure === null && (
        <KpiHeader period={period} />
      )}

      {desktop ? (
        <DashboardSections
          sections={sections}
          tab={tab}
          onScrollTo={current => setTab(dashboardTabParam(current))}
          ready={
            performance.lastRequest !== null && stocks.lastRequest !== null
          }
        />
      ) : (
        <Tabs
          value={tab}
          onValueChange={value =>
            setTab(dashboardTabParam(toDashboardTab(value)))
          }
        >
          {/* Scrolls rather than widening the page when Android's text
              scaling makes the labels too wide for the phone. */}
          <TabsList className="w-full sm:w-fit max-sm:overflow-x-auto max-sm:group-data-horizontal/tabs:h-auto">
            {DASHBOARD_TABS.map(value => {
              const Icon = DASHBOARD_TAB_ICONS[value];

              return (
                // Icon next to the label does not fit four times into 360px,
                // so phones stack them.
                <TabsTrigger
                  key={value}
                  value={value}
                  className="max-sm:flex-col max-sm:gap-0.5 max-sm:px-0 max-sm:py-1 sm:px-3"
                >
                  <Icon />
                  {t(`dashboard.tabs.${value}`)}
                </TabsTrigger>
              );
            })}
          </TabsList>
          {Object.entries(sections).map(([value, content]) => (
            <TabsContent key={value} value={value}>
              {content}
            </TabsContent>
          ))}
        </Tabs>
      )}

      {realtimeDates !== null && performance.lastRequest !== null && (
        <p className="px-1 text-xs text-muted-foreground">
          {t('dashboard.updated', {
            since: formatSince(
              Temporal.Instant.fromEpochMilliseconds(performance.lastRequest),
              Temporal.Now.zonedDateTimeISO()
            ),
          })}{' '}
          {realtimeDates[0] !== realtimeDates[1]
            ? t('dashboard.pricesFromTo', {
                start: realtimeDates[0],
                end: realtimeDates[1],
              })
            : t('dashboard.pricesOn', { date: realtimeDates[0] })}
        </p>
      )}
    </div>
  );
};

export default Dashboard;
