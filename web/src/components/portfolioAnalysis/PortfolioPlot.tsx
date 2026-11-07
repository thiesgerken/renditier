import {
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import { flatMap, find } from 'lodash';
import moment from 'moment';
import type { Moment } from 'moment';
import { useState, useCallback, useEffect } from 'react';
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
import { useSchemePalette } from '../../muiTheme';

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

const formControlSx = { m: 1, minWidth: 120 };

// [startDate, endDate, source] of the last range that was actually requested.
type PlotRange = [IsoDate, IsoDate, DataSourceSelection];

interface ModeSpec {
  label: string;
  tick: (value: number) => string;
  // a single series, colored by its sign
  signed?: {
    key: keyof StoredPortfolioPlotPoint;
    curve: 'linear' | 'stepAfter';
  };
}

const MODES = {
  earnings: {
    label: 'Gewinn',
    tick: currencyTick,
    signed: { key: 'earnings', curve: 'linear' },
  },
  investedAndValue: { label: 'Kaufpreis und Wert', tick: currencyTick },
  invested: { label: 'Kaufpreis', tick: currencyTick },
  investedRelStart: {
    label: 'Kaufpreisveränderung',
    tick: percentTick,
    signed: { key: 'investedRelStart', curve: 'stepAfter' },
  },
  value: { label: 'Wert', tick: currencyTick },
  valueRelStart: {
    label: 'Wertveränderung',
    tick: percentTick,
    signed: { key: 'valueRelStart', curve: 'linear' },
  },
  earningsRelInvested: {
    label: 'Gewinn rel. zu Kaufpreis',
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
  const theme = useTheme();
  const palette = useSchemePalette();
  const xsDown = useMediaQuery(theme.breakpoints.down('sm'));
  // The period that the custom range was set up for: picking another period
  // ends it, so that the plot follows the dashboard again.
  const [customFor, setCustomFor] = useState<string | null>(null);
  const customRange = period !== undefined && customFor === periodKey(period);
  const [mode, setMode] = useState<Mode>('earnings');
  const [source, setSource] = useState<DataSourceSelection>('auto');
  const [dates, setDates] = useState<[Moment | null, Moment | null]>([
    moment().startOf('year'),
    moment(),
  ]);
  const [prevRange, setPrevRange] = useState<PlotRange | null>(null);

  const handleModeChange = useCallback((event: SelectChangeEvent<Mode>) => {
    setMode(event.target.value);
  }, []);

  const handleSourceChange = useCallback(
    (event: SelectChangeEvent<DataSourceSelection>) => {
      setSource(event.target.value);
    },
    []
  );

  const handleDateChange = useCallback((v: [Moment | null, Moment | null]) => {
    setDates(v);
  }, []);

  // starts from the period's range, so that switching it on changes nothing
  // until the dates are edited
  const handleCustomRange = (on: boolean) => {
    if (!on || period === undefined) {
      setCustomFor(null);
      return;
    }
    const [start, end] = getPeriodRange(period);
    setDates([moment(start), moment(end)]);
    setCustomFor(periodKey(period));
  };

  let plotData: PortfolioPlotItem | null = null;
  let sd: IsoDate | null = null;
  let ed: IsoDate | null = null;

  if (period !== undefined) {
    if (!customRange) {
      [sd, ed] = getPeriodRange(period);
    } else {
      // FIXME(tsx-migration): the DatePickers hand back `null` when the user
      // clears a field, and the original called `.isValid()` on it unguarded,
      // which threw. The null now falls through to the same default the invalid
      // case already used.
      sd = (dates[0]?.isValid() ? dates[0] : moment().startOf('year')).format(
        'YYYY-MM-DD'
      );
      ed = (dates[1]?.isValid() ? dates[1] : moment()).format('YYYY-MM-DD');
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

  const tooltipRows = (p: Point): TooltipRow[] => [
    { label: 'Wert', value: formatCurrency(p.value) },
    { label: 'Investiert', value: formatCurrency(p.invested) },
    {
      label: 'Gewinn',
      value: formatAmountWithChange(p.earnings, p.earningsRelInvested),
    },
    ...(signed !== undefined && signed.key.endsWith('RelStart')
      ? [
          {
            label: MODES[mode].label,
            value: formatPlotPercent(p[signed.key] as number | null),
          },
        ]
      : []),
    ...tradeRows(p.trades, false),
  ];

  const loading =
    plotData === null || plotData.isFetching || performance.isFetching;

  return (
    <ProgressCard loading={loading} className="px-2">
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
              <CartesianGrid vertical={false} stroke={palette.divider} />

              {signed !== undefined &&
                signedArea(
                  signed.key,
                  MODES[mode].label,
                  points.map(p => p[signed.key] as number | null),
                  signed.curve,
                  palette
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

              {pointTooltip(intraday, tooltipRows)}
            </ComposedChart>
          </PlotArea>
          <TradeLegend points={points} />
        </Grid>
        <Grid size={12}>
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
          <FormControlLabel
            sx={formControlSx}
            control={
              <Switch
                checked={customRange}
                onChange={e => handleCustomRange(e.target.checked)}
              />
            }
            label="Eigener Zeitraum"
          />
          {customRange && (
            <>
              <DatePicker
                label="Start"
                value={dates[0]}
                format="L"
                // MUI wants `undefined`, not `null`, for "no bound"
                maxDate={dates[1] ?? undefined}
                onChange={d => handleDateChange([d, dates[1]])}
                disableFuture
                slotProps={{
                  textField: {
                    sx: formControlSx,
                    helperText: null,
                  },
                }}
              />
              <DatePicker
                label="Ende"
                value={dates[1]}
                format="L"
                // MUI wants `undefined`, not `null`, for "no bound"
                minDate={dates[0] ?? undefined}
                onChange={d => handleDateChange([dates[0], d])}
                disableFuture
                slotProps={{
                  textField: {
                    sx: formControlSx,
                    helperText: null,
                  },
                }}
              />
            </>
          )}
        </Grid>
      </Grid>
    </ProgressCard>
  );
};

export default PortfolioPlot;
