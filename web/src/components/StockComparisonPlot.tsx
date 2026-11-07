import { map, every, mapValues, sortBy } from 'lodash';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDownIcon } from 'lucide-react';
import { CartesianGrid, ComposedChart, Legend, Line, YAxis } from 'recharts';

import type { DataSourceSelection, IsoDate, IsoDateTime } from '../types/api';
import type {
  PerformanceState,
  StockPlotItem,
  StocksState,
  StoredStockPlotPoint,
} from '../types/store';
import { getPeriodDescription, getPeriodRange } from '../selectors/performance';
import PlotArea from './plot/PlotArea';
import { pointTooltip, timeXAxis } from './plot/elements';
import {
  formatPlotPercent,
  growthFactorAxis,
  growthFactorTick,
  hasIntradayPoints,
  percentTick,
} from './plot/axes';
import ProgressCard from './ProgressCard';
import {
  DateRangeFields,
  PlotControls,
  SelectField,
  SourceField,
} from './plot/PlotControls';
import type { DateRange } from './plot/PlotControls';
import { ZoomReset, useDragZoom } from './plot/zoom';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Label } from './ui/label';
import { abbreviateTitle, findStock } from '../selectors/stocks';
import useMediaQuery, { PHONE } from '../useMediaQuery';

function getData(
  items: StockPlotItem[],
  isin: string,
  startDate: IsoDate | null,
  endDate: IsoDate | null,
  source: DataSourceSelection
): StockPlotItem | null {
  let item: StockPlotItem | null = null;

  items.forEach(v => {
    if (
      v.startDate === startDate &&
      v.endDate === endDate &&
      v.source === source &&
      v.isin === isin
    )
      item = v;
  });

  return item;
}

// Material's 500 shades, distinct enough for up to nine lines.
const LINE_COLORS = [
  '#009688',
  '#ff5722',
  '#2196f3',
  '#ff9800',
  '#e91e63',
  '#4caf50',
  '#cddc39',
  '#673ab7',
  '#f44336',
];

const CUSTOM = -1;

// One row of the chart's data: the shared timestamp plus one `priceRelStart`
// entry per ISIN, keyed by the ISIN itself.
interface UnifiedPoint {
  date: IsoDateTime | null;
  epoch: number | null;
  [isin: string]: string | number | null;
}

// A point per date that any of the stocks has. Stocks without a point on that
// date get null; stocks whose series has already ended get no entry.
export const unifyPoints = (
  points: Record<string, StoredStockPlotPoint[]>,
  isins: string[]
): UnifiedPoint[] => {
  const cursors = isins.map(isin => ({
    isin,
    series: points[isin] ?? [],
    next: 0,
  }));
  const unifiedPoints: UnifiedPoint[] = [];

  for (;;) {
    // the earliest point not taken yet, across all series
    let earliest: StoredStockPlotPoint | undefined;
    for (const { series, next } of cursors) {
      const point = series[next];
      if (
        point !== undefined &&
        (earliest === undefined || point.epoch < earliest.epoch)
      )
        earliest = point;
    }
    if (earliest === undefined) return unifiedPoints;

    const rec: UnifiedPoint = { date: earliest.date, epoch: earliest.epoch };
    for (const cursor of cursors) {
      const point = cursor.series[cursor.next];
      if (point === undefined) continue;

      if (point.date === earliest.date) {
        rec[cursor.isin] = point.priceRelStart;
        cursor.next += 1;
      } else rec[cursor.isin] = null;
    }
    unifiedPoints.push(rec);
  }
};

interface Props {
  stocks: StocksState;
  performance: PerformanceState;
  data: StockPlotItem[];
  updateData: (
    isin: string | null,
    startDate: IsoDate | null,
    endDate: IsoDate | null,
    source: DataSourceSelection | null
  ) => void;
}

const StockComparisonPlot = ({
  stocks,
  performance,
  data,
  updateData,
}: Props) => {
  const { t } = useTranslation();
  const phone = useMediaQuery(PHONE);
  // an index into performance.data, or CUSTOM
  const [period, setPeriod] = useState(0);
  const [source, setSource] = useState<DataSourceSelection>('auto');
  const [logScale, setLogScale] = useState(true);
  const [dates, setDates] = useState<DateRange>(() => {
    const today = Temporal.Now.plainDateISO();
    return [today.subtract({ years: 2 }).with({ month: 1, day: 1 }), today];
  });
  const [prevRange, setPrevRange] = useState<
    [IsoDate | null, IsoDate | null, DataSourceSelection] | null
  >(null);
  let [isins, setIsins] = useState<string[] | null>(null); // eslint-disable-line prefer-const

  const plotData: Record<string, StockPlotItem | null> = {};

  if (isins === null) {
    isins = [];

    const firstPeriod = performance.data?.[0];
    if (firstPeriod !== undefined) {
      isins = map(
        sortBy(
          map(firstPeriod.positions, (p, isin) => ({
            perf: p,
            isin,
          })),
          p => p.perf.end.invested
        ),
        'isin'
      );
      if (isins.length === 0 && stocks.data !== null)
        isins = map(stocks.data, x => x.isin);

      if (isins.length > 3) isins = isins.slice(0, 3);
      if (isins.length > 0) setIsins(isins);
    }
  }

  // `isins` is a `let`, so TypeScript widens it back to `string[] | null` inside
  // the callbacks below; bind the settled value once so they see `string[]`.
  const currentIsins: string[] = isins;

  currentIsins.forEach(isin => {
    plotData[isin] = null;
  });

  let sd: IsoDate | null = null;
  let ed: IsoDate | null = null;

  if (performance.data !== null) {
    const selected = performance.data[period];
    if (selected !== undefined) {
      [sd, ed] = getPeriodRange(selected);
    } else {
      sd = dates[0].toString();
      ed = dates[1].toString();
    }

    currentIsins.forEach(isin => {
      plotData[isin] = getData(data, isin, sd, ed, source);

      const entry = plotData[isin];
      if ((entry === null || entry.isFetching) && prevRange !== null) {
        plotData[isin] = getData(
          data,
          isin,
          prevRange[0],
          prevRange[1],
          prevRange[2]
        );
      } else if (
        prevRange === null ||
        prevRange[0] !== sd ||
        prevRange[1] !== ed ||
        prevRange[2] !== source
      ) {
        setPrevRange([sd, ed, source]);
      }
    });
  }

  useEffect(() => {
    currentIsins.forEach(isin => updateData(isin, sd, ed, source));
    return undefined;
  }, [currentIsins, sd, ed, source, updateData]);

  const points = mapValues(plotData, v =>
    v !== null && v.data !== null ? v.data.points : []
  );
  const unifiedPoints = unifyPoints(points, currentIsins);

  // On a log axis, equal ratios get equal heights, so a stock that went up
  // sixfold does not flatten all others. Log space needs the growth factor,
  // which is not positive for a total loss, so such values are left out.
  const plotted = (relative: number | null): number | null => {
    if (relative === null || !logScale) return relative;
    const factor = 1 + relative / 100;
    return factor > 0 ? factor : null;
  };

  // the ISIN keys of a unified point hold `priceRelStart` values
  const relativeOf = (p: UnifiedPoint, isin: string): number | null =>
    (p[isin] ?? null) as number | null;

  const chartPoints = unifiedPoints.map(p => ({
    epoch: p.epoch as number,
    relative: p,
    ...Object.fromEntries(
      currentIsins.map(isin => [isin, plotted(relativeOf(p, isin))])
    ),
  }));
  type ChartPoint = (typeof chartPoints)[number];

  const epochs = unifiedPoints.map(p => p.epoch as number);
  const intraday = hasIntradayPoints(epochs);

  const plottedValues = unifiedPoints
    .flatMap(p => currentIsins.map(isin => plotted(relativeOf(p, isin))))
    .filter((v): v is number => v !== null);
  const yAxis = logScale
    ? growthFactorAxis(plottedValues)
    : { domain: ['auto', 'auto'] as const, ticks: undefined };

  const stockName = (isin: string): string => {
    const s = findStock(stocks, isin);
    return s === null ? isin : abbreviateTitle(s.title, true);
  };

  const colorOf = (isin: string, i: number): string => {
    const idx =
      stocks.data === null ? -1 : stocks.data.findIndex(s => s.isin === isin);
    const color = LINE_COLORS[(idx >= 0 ? idx : i) % LINE_COLORS.length];
    if (color === undefined) throw new Error('no line colours');
    return color;
  };

  const toggleIsin = (isin: string, on: boolean) =>
    setIsins(
      on
        ? [...currentIsins, isin]
        : currentIsins.filter(selected => selected !== isin)
    );

  // the names are long, so several are only counted
  const [firstIsin, ...moreIsins] = currentIsins;
  const selectionSummary =
    firstIsin === undefined
      ? t('stockComparison.none')
      : moreIsins.length === 0
        ? stockName(firstIsin)
        : t('stockComparison.selected', { count: currentIsins.length });

  const zoom = useDragZoom({
    snapshot: { period, dates },
    zoomTo: range => {
      setDates(range);
      setPeriod(CUSTOM);
    },
    restore: before => {
      setPeriod(before.period);
      setDates(before.dates);
    },
  });

  const loading =
    !every(plotData, p => p !== null && !p.isFetching) ||
    performance.isFetching;

  return (
    <ProgressCard loading={loading} className="px-2">
      <PlotArea isEmpty={chartPoints.length === 0} isLoading={loading}>
        <ComposedChart data={chartPoints} {...zoom.chartProps}>
          {timeXAxis(epochs)}
          <YAxis
            scale={logScale ? 'log' : 'auto'}
            domain={yAxis.domain}
            ticks={yAxis.ticks}
            allowDataOverflow={logScale}
            tickFormatter={logScale ? growthFactorTick : percentTick}
            width={90}
            hide={phone}
          />
          <CartesianGrid vertical={false} stroke="var(--border)" />

          {currentIsins.map((isin, i) => (
            <Line
              key={isin}
              type="linear"
              dataKey={isin}
              name={stockName(isin)}
              stroke={colorOf(isin, i)}
              strokeWidth={1.6}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          ))}
          <Legend />
          {pointTooltip(intraday, (point: ChartPoint) =>
            currentIsins.map((isin, i) => ({
              label: stockName(isin),
              value: formatPlotPercent(relativeOf(point.relative, isin)),
              color: colorOf(isin, i),
            }))
          )}
          {zoom.elements}
        </ComposedChart>
      </PlotArea>
      <PlotControls>
        <div className="grid gap-1.5">
          <Label
            htmlFor="comparison-isins"
            className="text-xs text-muted-foreground"
          >
            {t('stockComparison.securities')}
          </Label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                id="comparison-isins"
                variant="outline"
                className="w-60 justify-between font-normal"
              >
                <span className="truncate">{selectionSummary}</span>
                <ChevronDownIcon className="text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-72 w-72">
              {(stocks.data ?? []).map(s => (
                <DropdownMenuCheckboxItem
                  key={s.isin}
                  checked={currentIsins.includes(s.isin)}
                  onCheckedChange={on => toggleIsin(s.isin, on)}
                  // keeps the menu open for picking several
                  onSelect={event => event.preventDefault()}
                >
                  {abbreviateTitle(s.title, true)}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <SourceField
          id="comparison-source"
          value={source}
          onChange={setSource}
        />
        <SelectField
          id="comparison-scale"
          label={t('stockComparison.scale')}
          value={logScale ? 'log' : 'linear'}
          options={[
            { value: 'log', label: t('stockComparison.logarithmic') },
            { value: 'linear', label: t('stockComparison.linear') },
          ]}
          onChange={v => setLogScale(v === 'log')}
        />
        <SelectField
          id="comparison-period"
          label={t('plot.period')}
          value={String(performance.data?.length ? period : CUSTOM)}
          options={[
            ...(performance.data ?? []).map((item, i) => ({
              value: String(i),
              label: getPeriodDescription(item),
            })),
            { value: String(CUSTOM), label: t('plot.custom') },
          ]}
          onChange={v => {
            setPeriod(Number(v));
            zoom.forget();
          }}
        />
        {period === CUSTOM && (
          <DateRangeFields value={dates} onChange={setDates} />
        )}
        {zoom.reset !== null && <ZoomReset onClick={zoom.reset} />}
      </PlotControls>
    </ProgressCard>
  );
};

export default StockComparisonPlot;
