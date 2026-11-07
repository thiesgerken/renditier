import { useState, useEffect } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  YAxis,
} from 'recharts';

import {
  getPeriodDescription,
  getPeriodRange,
} from '../../selectors/performance';
import { formatCurrency, formatUnits } from '../../format';
import ProgressCard from '../ProgressCard';
import PlotArea from '../plot/PlotArea';
import type { TooltipRow } from '../plot/PlotTooltip';
import {
  currencyTick,
  formatAmountWithChange,
  formatPlotPercent,
  formatPointDate,
  hasIntradayPoints,
  numberTick,
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
import type {
  DataSourceSelection,
  IsoDate,
  Transaction,
} from '../../types/api';
import type {
  PerformanceState,
  StockPlotItem,
  StoredStockPlotPoint,
} from '../../types/store';
import useMediaQuery, { PHONE } from '../../useMediaQuery';
import {
  DateRangeFields,
  PlotControls,
  SOURCES,
  SelectField,
} from '../plot/PlotControls';
import type { DateRange } from '../plot/PlotControls';
import { ZoomReset, useDragZoom } from '../plot/zoom';

interface Props {
  isin: string;
  performance: PerformanceState;
  // all buys and sells of this stock
  transactions: Transaction[];
  data: StockPlotItem[];
  updateData: (
    isin: string,
    startDate: IsoDate | null,
    endDate: IsoDate | null,
    source: DataSourceSelection
  ) => void;
}

// [startDate, endDate, source] of the last range that was actually requested.
type Range = [IsoDate, IsoDate, DataSourceSelection];

function getData(
  items: StockPlotItem[],
  isin: string,
  startDate: IsoDate,
  endDate: IsoDate,
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

const UNITS_AXIS = 'units';

const CUSTOM = -1;

// Whether a price's time and a point's epoch fall into the same minute or day
// of the browser's time zone.
const sameTime = (
  priceDate: string,
  epoch: number,
  unit: 'minute' | 'day'
): boolean => {
  const zone = Temporal.Now.timeZoneId();
  const a = Temporal.Instant.from(priceDate).toZonedDateTimeISO(zone);
  const b =
    Temporal.Instant.fromEpochMilliseconds(epoch).toZonedDateTimeISO(zone);
  return unit === 'day'
    ? a.toPlainDate().equals(b.toPlainDate())
    : a
        .round({ smallestUnit: 'minute', roundingMode: 'floor' })
        .equals(b.round({ smallestUnit: 'minute', roundingMode: 'floor' }));
};

interface ModeSpec {
  label: string;
  tick: (value: number) => string;
  // a single series, colored by its sign
  signed?: {
    key: keyof StoredStockPlotPoint;
    curve: 'linear' | 'stepAfter';
  };
}

const MODES = {
  price: { label: 'Kurs', tick: currencyTick },
  priceRelStart: {
    label: 'Kursveränderung',
    tick: percentTick,
    signed: { key: 'priceRelStart', curve: 'linear' },
  },
  units: { label: 'Einheiten', tick: numberTick },
  priceAndUnits: { label: 'Kurs und Einheiten', tick: currencyTick },
  investedAndValue: { label: 'Kaufpreis und Wert', tick: currencyTick },
  value: { label: 'Wert', tick: currencyTick },
  valueRelStart: {
    label: 'Wertveränderung',
    tick: percentTick,
    signed: { key: 'valueRelStart', curve: 'linear' },
  },
  invested: { label: 'Kaufpreis', tick: currencyTick },
  investedRelStart: {
    label: 'Kaufpreisveränderung',
    tick: percentTick,
    signed: { key: 'investedRelStart', curve: 'stepAfter' },
  },
  earnings: {
    label: 'Gewinn',
    tick: currencyTick,
    signed: { key: 'earnings', curve: 'linear' },
  },
  earningsRelInvestment: {
    label: 'Gewinn rel. zu Kaufpreis',
    tick: percentTick,
    signed: { key: 'earningsRelInvestment', curve: 'linear' },
  },
} satisfies Record<string, ModeSpec>;

type Mode = keyof typeof MODES;

const StockPlot = ({
  isin,
  performance,
  transactions,
  data,
  updateData,
}: Props) => {
  const phone = useMediaQuery(PHONE);
  // an index into performance.data, or CUSTOM
  const [period, setPeriod] = useState(0);
  const [mode, setMode] = useState<Mode>('priceAndUnits');
  const [source, setSource] = useState<DataSourceSelection>('auto');
  const [dates, setDates] = useState<DateRange>(() => {
    const today = Temporal.Now.plainDateISO();
    return [today.with({ month: 1, day: 1 }), today];
  });
  const [prevRange, setPrevRange] = useState<Range | null>(null);

  let plotData: StockPlotItem | null = null;
  let sd: IsoDate | null = null;
  let ed: IsoDate | null = null;

  if (performance.data !== null && period < performance.data.length) {
    if (period === CUSTOM) {
      sd = dates[0].toString();
      ed = dates[1].toString();
    } else {
      [sd, ed] = getPeriodRange(performance.data[period]);
    }

    plotData = getData(data, isin, sd, ed, source);

    if ((plotData === null || plotData.isFetching) && prevRange !== null) {
      plotData = getData(data, isin, prevRange[0], prevRange[1], prevRange[2]);
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
    updateData(isin, sd, ed, source);
    return undefined;
  }, [isin, sd, ed, source, updateData]);

  const points = assignTrades(
    plotData !== null && plotData.data !== null ? plotData.data.points : [],
    transactions
  );
  type Point = (typeof points)[number];

  const epochs = points.map(p => p.epoch);
  const intraday = hasIntradayPoints(epochs);
  const { tick, signed }: ModeSpec = MODES[mode];

  // Prices can be older than the point, e.g. on holidays. Historical prices
  // carry no time of day, only realtime quotes do.
  const olderPriceRows = ({ priceDate, epoch }: Point): TooltipRow[] =>
    priceDate === null ||
    sameTime(priceDate, epoch, intraday ? 'minute' : 'day')
      ? []
      : [
          {
            label: 'Kurs vom',
            value: formatPointDate(
              Temporal.Instant.from(priceDate).epochMilliseconds,
              intraday
            ),
          },
        ];

  const tooltipRows = (p: Point): TooltipRow[] => [
    { label: 'Kurs', value: formatCurrency(p.price) },
    { label: 'Einheiten', value: formatUnits(p.units, { maxDigits: 3 }) },
    { label: 'Wert', value: formatCurrency(p.value) },
    { label: 'Investiert', value: formatCurrency(p.invested) },
    {
      label: 'Gewinn',
      value: formatAmountWithChange(p.earnings, p.earningsRelInvestment),
    },
    ...(signed !== undefined && signed.key.endsWith('RelStart')
      ? [
          {
            label: MODES[mode].label,
            value: formatPlotPercent(p[signed.key] as number | null),
          },
        ]
      : []),
    ...olderPriceRows(p),
    ...tradeRows(p.trades, true),
  ];

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
    plotData === null || plotData.isFetching || performance.isFetching;

  return (
    <ProgressCard loading={loading} className="px-2">
      <PlotArea isEmpty={points.length === 0} isLoading={loading}>
        <ComposedChart data={points} {...zoom.chartProps}>
          {timeXAxis(epochs)}
          <YAxis
            tickFormatter={tick}
            domain={['auto', 'auto']}
            width={90}
            hide={phone}
          />
          <YAxis yAxisId={TRADES_AXIS} domain={[0, 1]} hide />
          {mode === 'priceAndUnits' && (
            <YAxis
              yAxisId={UNITS_AXIS}
              orientation="right"
              tickFormatter={numberTick}
              domain={[0, 'auto']}
              hide={phone}
              label={{
                value: 'Einheiten',
                angle: 90,
                position: 'insideRight',
                fill: 'var(--muted-foreground)',
              }}
            />
          )}
          <CartesianGrid vertical={false} stroke="var(--border)" />

          {signed !== undefined &&
            signedArea(
              signed.key,
              MODES[mode].label,
              points.map(p => p[signed.key] as number | null),
              signed.curve
            )}

          {mode === 'price' && (
            <Area
              type="linear"
              dataKey="price"
              name="Kurs"
              stroke="var(--chart-price)"
              fill="var(--chart-price)"
              fillOpacity={0.15}
              strokeWidth={1.4}
              dot={false}
              isAnimationActive={false}
            />
          )}

          {mode === 'priceAndUnits' && [
            <Line
              key="price"
              type="linear"
              dataKey="price"
              name="Kurs"
              stroke="var(--chart-price)"
              strokeWidth={1.4}
              dot={false}
              isAnimationActive={false}
            />,
            <Line
              key="units"
              yAxisId={UNITS_AXIS}
              type="stepAfter"
              dataKey="units"
              name="Einheiten"
              stroke="var(--chart-units)"
              strokeWidth={1.4}
              dot={false}
              isAnimationActive={false}
            />,
          ]}

          {mode === 'units' && (
            <Area
              type="stepAfter"
              dataKey="units"
              name="Einheiten"
              stroke="var(--chart-units)"
              fill="var(--chart-units)"
              fillOpacity={0.15}
              strokeWidth={1.4}
              dot={false}
              isAnimationActive={false}
            />
          )}

          {(mode === 'investedAndValue' || mode === 'value') && (
            <Area
              type="linear"
              dataKey="value"
              name="Wert"
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
              name="Investiert"
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
              name="Investiert"
              stroke="var(--loss)"
              strokeWidth={1.4}
              dot={false}
              isAnimationActive={false}
            />
          )}

          {tradeMarkers()}

          {(mode === 'priceAndUnits' || mode === 'investedAndValue') && (
            <Legend />
          )}

          {pointTooltip(intraday, tooltipRows)}
          {zoom.elements}
        </ComposedChart>
      </PlotArea>
      <TradeLegend points={points} />
      <PlotControls>
        <SelectField
          id="stock-plot-mode"
          label="Art"
          value={mode}
          options={Object.entries(MODES).map(([value, { label }]) => ({
            value: value as Mode,
            label,
          }))}
          onChange={setMode}
        />
        <SelectField
          id="stock-plot-source"
          label="Datenquelle"
          value={source}
          options={SOURCES}
          onChange={setSource}
        />
        <SelectField
          id="stock-plot-period"
          label="Zeitraum"
          value={String(performance.data?.length ? period : CUSTOM)}
          options={[
            ...(performance.data ?? []).map((item, i) => ({
              value: String(i),
              label: getPeriodDescription(item),
            })),
            { value: String(CUSTOM), label: 'Benutzerdefiniert' },
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

export default StockPlot;
