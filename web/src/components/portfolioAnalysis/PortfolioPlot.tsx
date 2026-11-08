import { flatMap, find } from 'lodash';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Area, CartesianGrid, ComposedChart, Line, YAxis } from 'recharts';

import type {
  DataSourceSelection,
  IsoDate,
  PortfolioPerformance,
} from '../../types/api';
import type {
  PerformanceState,
  PortfolioPlotItem,
  StoredPortfolioPlotPoint,
} from '../../types/store';
import { getPeriodRange, periodKey } from '../../selectors/performance';
import { formatCurrency } from '../../format';
import ProgressCard from '../ProgressCard';
import PlotArea from '../plot/PlotArea';
import type { TooltipRow } from '../plot/PlotTooltip';
import {
  currencyTick,
  formatAmountWithChange,
  formatPlotPercent,
  hasIntradayPoints,
  percentTick,
} from '../plot/axes';
import { assignTrades } from '../plot/trades';
import {
  TRADES_AXIS,
  TradeLegend,
  tradeMarkers,
  tradeRows,
} from '../plot/tradeMarkers';
import { pointTooltip, signedArea, timeXAxis } from '../plot/elements';
import useMediaQuery, { PHONE } from '../../useMediaQuery';
import {
  DateRangeFields,
  PlotControls,
  SelectField,
  SourceField,
} from '../plot/PlotControls';
import type { DateRange } from '../plot/PlotControls';
import { ZoomReset, useDragZoom } from '../plot/zoom';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';

function getData(
  items: PortfolioPlotItem[],
  startDate: IsoDate,
  endDate: IsoDate,
  source: DataSourceSelection
): PortfolioPlotItem | null {
  let item: PortfolioPlotItem | null = null;

  items.forEach(v => {
    if (
      v.startDate === startDate &&
      v.endDate === endDate &&
      v.source === source
    )
      item = v;
  });

  return item;
}

// [startDate, endDate, source] of the last range that was actually requested.
type PlotRange = [IsoDate, IsoDate, DataSourceSelection];

// labelled by `plot.modes.*`
interface ModeSpec {
  tick: (value: number) => string;
  // a single series, colored by its sign
  signed?: {
    key: keyof StoredPortfolioPlotPoint;
    curve: 'linear' | 'stepAfter';
  };
}

const MODES = {
  earnings: {
    tick: currencyTick,
    signed: { key: 'earnings', curve: 'linear' },
  },
  investedAndValue: { tick: currencyTick },
  invested: { tick: currencyTick },
  investedRelStart: {
    tick: percentTick,
    signed: { key: 'investedRelStart', curve: 'stepAfter' },
  },
  value: { tick: currencyTick },
  valueRelStart: {
    tick: percentTick,
    signed: { key: 'valueRelStart', curve: 'linear' },
  },
  earningsRelInvested: {
    tick: percentTick,
    signed: { key: 'earningsRelInvested', curve: 'linear' },
  },
} satisfies Record<string, ModeSpec>;

type Mode = keyof typeof MODES;

interface Props {
  data: PortfolioPlotItem[];
  updateData: (
    startDate: IsoDate | null,
    endDate: IsoDate | null,
    source: DataSourceSelection | null
  ) => void;
  performance: PerformanceState;
  // the dashboard's period, which the plot shows unless it has its own range
  period: PortfolioPerformance | undefined;
}

const PortfolioPlot = ({ performance, period, data, updateData }: Props) => {
  const { t } = useTranslation();
  const phone = useMediaQuery(PHONE);
  // The period that the custom range was set up for: picking another period
  // ends it, so that the plot follows the dashboard again.
  const [customFor, setCustomFor] = useState<string | null>(null);
  const customRange = period !== undefined && customFor === periodKey(period);
  const [mode, setMode] = useState<Mode>('earnings');
  const [source, setSource] = useState<DataSourceSelection>('auto');
  // only read while customRange is on, which seeds it first
  const [dates, setDates] = useState<DateRange | null>(null);
  const [prevRange, setPrevRange] = useState<PlotRange | null>(null);

  const zoom = useDragZoom({
    snapshot: { customFor, dates },
    zoomTo: range => {
      if (period === undefined) return;
      setDates(range);
      setCustomFor(periodKey(period));
    },
    restore: before => {
      setCustomFor(before.customFor);
      setDates(before.dates);
    },
  });

  // starts from the period's range, so that switching it on changes nothing
  // until the dates are edited
  const handleCustomRange = (on: boolean) => {
    zoom.forget();
    if (!on || period === undefined) {
      setCustomFor(null);
      return;
    }
    const [start, end] = getPeriodRange(period);
    setDates([Temporal.PlainDate.from(start), Temporal.PlainDate.from(end)]);
    setCustomFor(periodKey(period));
  };

  let plotData: PortfolioPlotItem | null = null;
  let sd: IsoDate | null = null;
  let ed: IsoDate | null = null;

  if (period !== undefined) {
    if (customRange && dates !== null) {
      sd = dates[0].toString();
      ed = dates[1].toString();
    } else {
      [sd, ed] = getPeriodRange(period);
    }

    plotData = getData(data, sd, ed, source);

    if ((plotData === null || plotData.isFetching) && prevRange !== null) {
      plotData = getData(data, prevRange[0], prevRange[1], prevRange[2]);
    } else if (
      prevRange === null ||
      prevRange[0] !== sd ||
      prevRange[1] !== ed ||
      prevRange[2] !== source
    ) {
      setPrevRange([sd, ed, source]);
    }
  }

  useEffect(() => {
    updateData(sd, ed, source);
    return undefined;
  }, [sd, ed, source, updateData]);

  // Every buy and sell is part of the "Total" period's positions.
  const total = find(performance.data, p => p.kind === 'Total');
  const points = assignTrades(
    plotData !== null && plotData.data !== null ? plotData.data.points : [],
    total === undefined
      ? []
      : flatMap(Object.values(total.positions), p => p.transactions)
  );
  type Point = (typeof points)[number];

  const epochs = points.map(p => p.epoch);
  const intraday = hasIntradayPoints(epochs);
  const { tick, signed }: ModeSpec = MODES[mode];
  const modeLabel = t(`plot.modes.${mode}`);

  const tooltipRows = (p: Point): TooltipRow[] => [
    { label: t('plot.value'), value: formatCurrency(p.value) },
    { label: t('plot.invested'), value: formatCurrency(p.invested) },
    {
      label: t('plot.gain'),
      value: formatAmountWithChange(p.earnings, p.earningsRelInvested),
    },
    ...(signed !== undefined && signed.key.endsWith('RelStart')
      ? [
          {
            label: modeLabel,
            value: formatPlotPercent(p[signed.key] as number | null),
          },
        ]
      : []),
    ...tradeRows(p.trades, false),
  ];

  // tells "nothing yet at all" from "nothing in this period"
  const hasTransactions =
    performance.data?.some(p => Object.keys(p.positions).length > 0) ?? false;

  const loading =
    plotData === null || plotData.isFetching || performance.isFetching;

  return (
    <ProgressCard loading={loading} className="px-2">
      <div>
        <PlotArea
          isEmpty={points.length === 0}
          emptyText={
            hasTransactions
              ? t('plot.empty.period')
              : t('plot.empty.noTransactions')
          }
          isLoading={loading}
        >
          <ComposedChart data={points} {...zoom.chartProps}>
            {timeXAxis(epochs)}
            <YAxis
              tickFormatter={tick}
              domain={['auto', 'auto']}
              width={90}
              hide={phone}
            />
            <YAxis yAxisId={TRADES_AXIS} domain={[0, 1]} hide />
            <CartesianGrid vertical={false} stroke="var(--border)" />

            {signed !== undefined &&
              signedArea(
                signed.key,
                modeLabel,
                points.map(p => p[signed.key] as number | null),
                signed.curve
              )}

            {(mode === 'investedAndValue' || mode === 'value') && (
              <Area
                type="linear"
                dataKey="value"
                name={t('plot.value')}
                stroke="var(--gain)"
                fill="var(--gain)"
                fillOpacity={0.15}
                strokeWidth={1.4}
                dot={false}
                isAnimationActive={false}
              />
            )}

            {mode === 'invested' && (
              <Area
                type="stepAfter"
                dataKey="invested"
                name={t('plot.invested')}
                stroke="var(--loss)"
                fill="var(--loss)"
                fillOpacity={0.15}
                strokeWidth={1.4}
                dot={false}
                isAnimationActive={false}
              />
            )}

            {mode === 'investedAndValue' && (
              <Line
                type="stepAfter"
                dataKey="invested"
                name={t('plot.invested')}
                stroke="var(--loss)"
                strokeWidth={1.4}
                dot={false}
                isAnimationActive={false}
              />
            )}

            {tradeMarkers()}

            {pointTooltip(intraday, tooltipRows)}
            {zoom.elements}
          </ComposedChart>
        </PlotArea>
        <TradeLegend points={points} />
      </div>
      <PlotControls>
        <SelectField
          id="portfolio-plot-mode"
          label={t('plot.mode')}
          value={mode}
          options={(Object.keys(MODES) as Mode[]).map(value => ({
            value,
            label: t(`plot.modes.${value}`),
          }))}
          onChange={setMode}
        />
        <SourceField
          id="portfolio-plot-source"
          value={source}
          onChange={setSource}
        />
        <div className="flex h-8 items-center gap-2">
          <Switch
            id="portfolio-plot-custom"
            checked={customRange}
            onCheckedChange={handleCustomRange}
          />
          <Label htmlFor="portfolio-plot-custom">{t('plot.customRange')}</Label>
        </div>
        {customRange && dates !== null && (
          <DateRangeFields value={dates} onChange={setDates} />
        )}
        {/* another dashboard period ends the custom range, and the zoom */}
        {zoom.reset !== null && customRange && (
          <ZoomReset onClick={zoom.reset} />
        )}
      </PlotControls>
    </ProgressCard>
  );
};

export default PortfolioPlot;
