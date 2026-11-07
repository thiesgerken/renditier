import {
  Container,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import moment from 'moment';
import { useState, useCallback, useEffect } from 'react';
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
import { formatCurrency, formatNumber } from '../../format';
import ProgressPaper from '../ProgressPaper';
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
import { useSchemePalette } from '../../muiTheme';

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

const formControlSx = { m: 1, minWidth: 120 };

const UNITS_AXIS = 'units';

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
  const theme = useTheme();
  const palette = useSchemePalette();
  const xsDown = useMediaQuery(theme.breakpoints.down('sm'));
  const [period, setPeriod] = useState(0);
  const [mode, setMode] = useState<Mode>('priceAndUnits');
  const [source, setSource] = useState<DataSourceSelection>('auto');
  const [dates, setDates] = useState<moment.Moment[]>([
    moment().startOf('year'),
    moment(),
  ]);
  const [prevRange, setPrevRange] = useState<Range | null>(null);

  const handlePeriodChange = useCallback((event: SelectChangeEvent<number>) => {
    setPeriod(event.target.value);
  }, []);

  const handleModeChange = useCallback((event: SelectChangeEvent<Mode>) => {
    setMode(event.target.value);
  }, []);

  const handleSourceChange = useCallback(
    (event: SelectChangeEvent<DataSourceSelection>) => {
      setSource(event.target.value);
    },
    []
  );

  const handleDateChange = useCallback((v: moment.Moment[]) => {
    setDates(v);
  }, []);

  let plotData: StockPlotItem | null = null;
  let sd: IsoDate | null = null;
  let ed: IsoDate | null = null;

  if (performance.data !== null && period < performance.data.length) {
    if (period >= 0) {
      [sd, ed] = getPeriodRange(performance.data[period]);
    } else {
      sd = (dates[0].isValid() ? dates[0] : moment().startOf('year')).format(
        'YYYY-MM-DD'
      );
      ed = (dates[1].isValid() ? dates[1] : moment()).format('YYYY-MM-DD');
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
  const priceIsOlder = (p: Point): boolean =>
    p.priceDate !== null &&
    !moment(p.priceDate).isSame(p.epoch, intraday ? 'minute' : 'day');

  const tooltipRows = (p: Point): TooltipRow[] => [
    { label: 'Kurs', value: formatCurrency(p.price) },
    { label: 'Einheiten', value: formatNumber(p.units, { digits: 3 }) },
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
    ...(priceIsOlder(p)
      ? [
          {
            label: 'Kurs vom',
            value: formatPointDate(moment(p.priceDate).valueOf(), intraday),
          },
        ]
      : []),
    ...tradeRows(p.trades, true),
  ];

  const loading =
    plotData === null || plotData.isFetching || performance.isFetching;

  return (
    <Container maxWidth="xl" style={{ padding: '0px' }}>
      <ProgressPaper
        loading={loading}
        style={{ width: '100%', padding: theme.spacing(1) }}
      >
        <Grid container style={{ width: '100%' }}>
          <Grid size={12}>
            <PlotArea isEmpty={points.length === 0} isLoading={loading}>
              <ComposedChart data={points}>
                {timeXAxis(epochs)}
                <YAxis
                  tickFormatter={tick}
                  domain={['auto', 'auto']}
                  width={90}
                  hide={xsDown}
                />
                <YAxis yAxisId={TRADES_AXIS} domain={[0, 1]} hide />
                {mode === 'priceAndUnits' && (
                  <YAxis
                    yAxisId={UNITS_AXIS}
                    orientation="right"
                    tickFormatter={numberTick}
                    domain={[0, 'auto']}
                    hide={xsDown}
                    label={{
                      value: 'Einheiten',
                      angle: 90,
                      position: 'insideRight',
                      fill: palette.text.secondary,
                    }}
                  />
                )}
                <CartesianGrid vertical={false} stroke={palette.divider} />

                {signed !== undefined &&
                  signedArea(
                    signed.key,
                    MODES[mode].label,
                    points.map(p => p[signed.key] as number | null),
                    signed.curve,
                    palette
                  )}

                {mode === 'price' && (
                  <Area
                    type="linear"
                    dataKey="price"
                    name="Kurs"
                    stroke={palette.info.dark}
                    fill={palette.info.main}
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
                    stroke={palette.info.dark}
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
                    stroke={palette.warning.dark}
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
                    stroke={palette.warning.dark}
                    fill={palette.warning.main}
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
                    stroke={palette.primary.dark}
                    fill={palette.primary.main}
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
                    stroke={palette.secondary.dark}
                    fill={palette.secondary.main}
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
                    stroke={palette.secondary.dark}
                    strokeWidth={1.4}
                    dot={false}
                    isAnimationActive={false}
                  />
                )}

                {tradeMarkers(palette)}

                {(mode === 'priceAndUnits' || mode === 'investedAndValue') && (
                  <Legend />
                )}

                {pointTooltip(intraday, tooltipRows)}
              </ComposedChart>
            </PlotArea>
            <TradeLegend points={points} />
          </Grid>
          <Grid size={9}>
            <FormControl sx={formControlSx} variant="standard">
              <InputLabel id="mode-select-label">Art</InputLabel>
              <Select
                labelId="mode-select-label"
                id="mode-select"
                label="Art"
                value={mode}
                autoWidth
                onChange={handleModeChange}
              >
                {Object.entries(MODES).map(([value, { label }]) => (
                  <MenuItem key={value} value={value}>
                    {label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl sx={formControlSx} variant="standard">
              <InputLabel id="source-select-label">Datenquelle</InputLabel>
              <Select
                labelId="source-select-label"
                id="source-select"
                label="Datenquelle"
                value={source}
                autoWidth
                onChange={handleSourceChange}
              >
                <MenuItem value="auto">Automatisch</MenuItem>
                <MenuItem value="historical">Historisch</MenuItem>
                <MenuItem value="realtime">Echtzeit</MenuItem>
              </Select>
            </FormControl>
            <FormControl sx={formControlSx} variant="standard">
              <InputLabel id="period-select-label">Zeit</InputLabel>
              <Select
                labelId="period-select-label"
                id="period-select"
                label="Zeit"
                autoWidth
                value={
                  performance.data === null || performance.data.length === 0
                    ? -1
                    : period
                }
                onChange={handlePeriodChange}
              >
                {performance.data !== null &&
                  performance.data.map((item, i) => (
                    <MenuItem value={i} key={i}>
                      {getPeriodDescription(item)}
                    </MenuItem>
                  ))}
                <MenuItem value={-1} key={-1}>
                  Benutzerdefiniert
                </MenuItem>
              </Select>
            </FormControl>
            {period < 0 && (
              <>
                {/* <DateRangePicker
                  startText="Start"
                  endText="Ende"
                  value={dates}
                  onChange={handleDateChange}
                  disableFuture
                  sx={formControlSx}
                /> */}
                <DatePicker
                  label="Start"
                  value={dates[0]}
                  format="L"
                  maxDate={dates[1]}
                  // FIXME(tsx-migration): clearing the picker used to push `null`
                  // into `dates`, which then threw in `dates[0].isValid()` above.
                  // Keeping the previous value is the smallest safe behaviour.
                  onChange={d => handleDateChange([d ?? dates[0], dates[1]])}
                  disableFuture
                  disabled={period >= 0}
                  slotProps={{
                    textField: {
                      sx: formControlSx,
                    },
                  }}
                />
                <DatePicker
                  label="Ende"
                  value={dates[1]}
                  format="L"
                  minDate={dates[0]}
                  // FIXME(tsx-migration): see the "Start" picker above.
                  onChange={d => handleDateChange([dates[0], d ?? dates[1]])}
                  disableFuture
                  disabled={period >= 0}
                  slotProps={{
                    textField: {
                      sx: formControlSx,
                    },
                  }}
                />
              </>
            )}
          </Grid>
        </Grid>
      </ProgressPaper>
    </Container>
  );
};

export default StockPlot;
