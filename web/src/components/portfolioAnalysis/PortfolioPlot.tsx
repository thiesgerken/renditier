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
import { flatMap, find } from 'lodash';
import moment from 'moment';
import type { Moment } from 'moment';
import { useState, useCallback, useEffect } from 'react';
import { Area, CartesianGrid, ComposedChart, Line, YAxis } from 'recharts';

import type { DataSourceSelection, IsoDate } from '../../types/api';
import type {
  PerformanceState,
  PortfolioPlotItem,
  StoredPortfolioPlotPoint,
} from '../../types/store';
import {
  getPeriodDescription,
  getPeriodRange,
} from '../../selectors/performance';
import { formatCurrency, formatPercent } from '../../format';
import ProgressPaper from '../ProgressPaper';
import PlotArea from '../plot/PlotArea';
import type { TooltipRow } from '../plot/PlotTooltip';
import { currencyTick, hasIntradayPoints, percentTick } from '../plot/axes';
import { assignTrades } from '../plot/trades';
import { TRADES_AXIS, tradeMarkers, tradeRows } from '../plot/tradeMarkers';
import { pointTooltip, signedArea, timeXAxis } from '../plot/elements';

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

type Mode =
  | 'earnings'
  | 'investedAndValue'
  | 'invested'
  | 'investedRelStart'
  | 'value'
  | 'valueRelStart'
  | 'earningsRelInvested';

// Modes that show one series, colored by its sign.
const SIGNED_SERIES: Partial<
  Record<Mode, { name: string; key: keyof StoredPortfolioPlotPoint }>
> = {
  earnings: { name: 'Gewinn', key: 'earnings' },
  valueRelStart: { name: 'Wertveränderung', key: 'valueRelStart' },
  investedRelStart: {
    name: 'Kaufpreisveränderung',
    key: 'investedRelStart',
  },
  earningsRelInvested: {
    name: 'Gewinn rel. Kaufpreis',
    key: 'earningsRelInvested',
  },
};

interface Props {
  data: PortfolioPlotItem[];
  updateData: (
    startDate: IsoDate | null,
    endDate: IsoDate | null,
    source: DataSourceSelection | null
  ) => void;
  performance: PerformanceState;
}

const PortfolioPlot = ({ performance, data, updateData }: Props) => {
  const theme = useTheme();
  const xsDown = useMediaQuery(theme.breakpoints.down('sm'));
  const [period, setPeriod] = useState(0);
  const [mode, setMode] = useState<Mode>('earnings');
  const [source, setSource] = useState<DataSourceSelection>('auto');
  const [dates, setDates] = useState<[Moment | null, Moment | null]>([
    moment().startOf('year'),
    moment(),
  ]);
  const [prevRange, setPrevRange] = useState<PlotRange | null>(null);

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

  const handleDateChange = useCallback((v: [Moment | null, Moment | null]) => {
    setDates(v);
  }, []);

  let plotData: PortfolioPlotItem | null = null;
  let sd: IsoDate | null = null;
  let ed: IsoDate | null = null;

  if (performance.data !== null && period < performance.data.length) {
    if (period >= 0) {
      [sd, ed] = getPeriodRange(performance.data[period]);
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
  const isRelative =
    mode.endsWith('RelStart') || mode === 'earningsRelInvested';
  const signedSeries = SIGNED_SERIES[mode];

  const tooltipRows = (p: Point): TooltipRow[] => {
    const rows: TooltipRow[] = [
      { label: 'Wert', value: formatCurrency(p.value) },
      { label: 'Investiert', value: formatCurrency(p.invested) },
      {
        label: 'Gewinn',
        value:
          p.earningsRelInvested === null
            ? formatCurrency(p.earnings)
            : `${formatCurrency(p.earnings)} (${formatPercent(
                p.earningsRelInvested / 100,
                { signed: true }
              )})`,
      },
    ];
    if (mode === 'valueRelStart')
      rows.push({
        label: 'Wertveränderung',
        value: formatPercent((p.valueRelStart ?? 0) / 100, { signed: true }),
      });
    if (mode === 'investedRelStart')
      rows.push({
        label: 'Kaufpreisveränderung',
        value: formatPercent((p.investedRelStart ?? 0) / 100, {
          signed: true,
        }),
      });

    return [...rows, ...tradeRows(p.trades, false)];
  };

  const loading =
    plotData === null || plotData.isFetching || performance.isFetching;

  return (
    <Container maxWidth="xl" style={{ padding: '0px' }}>
      <ProgressPaper
        style={{ width: '100%', padding: theme.spacing(1) }}
        loading={loading}
      >
        <Grid container style={{ width: '100%' }}>
          <Grid size={12}>
            <PlotArea isEmpty={points.length === 0} isLoading={loading}>
              <ComposedChart data={points}>
                {timeXAxis(epochs)}
                <YAxis
                  tickFormatter={isRelative ? percentTick : currencyTick}
                  domain={['auto', 'auto']}
                  width={90}
                  hide={xsDown}
                />
                <YAxis yAxisId={TRADES_AXIS} domain={[0, 1]} hide />
                <CartesianGrid
                  vertical={false}
                  stroke={theme.palette.divider}
                />

                {signedSeries !== undefined &&
                  signedArea(
                    signedSeries.key,
                    signedSeries.name,
                    points.map(p => p[signedSeries.key] as number | null),
                    mode === 'investedRelStart' ? 'stepAfter' : 'linear',
                    theme
                  )}

                {(mode === 'investedAndValue' || mode === 'value') && (
                  <Area
                    type="linear"
                    dataKey="value"
                    name="Wert"
                    stroke={theme.palette.primary.dark}
                    fill={theme.palette.primary.main}
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
                    stroke={theme.palette.secondary.dark}
                    fill={theme.palette.secondary.main}
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
                    stroke={theme.palette.secondary.dark}
                    strokeWidth={1.4}
                    dot={false}
                    isAnimationActive={false}
                  />
                )}

                {tradeMarkers(theme)}

                {pointTooltip(intraday, tooltipRows)}
              </ComposedChart>
            </PlotArea>
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
                <MenuItem value="earnings">Gewinn</MenuItem>
                <MenuItem value="investedAndValue">Kaufpreis und Wert</MenuItem>
                <MenuItem value="invested">Kaufpreis</MenuItem>
                <MenuItem value="investedRelStart">
                  Kaufpreisveränderung
                </MenuItem>
                <MenuItem value="value">Wert</MenuItem>
                <MenuItem value="valueRelStart">Wertveränderung</MenuItem>
                <MenuItem value="earningsRelInvested">
                  Gewinn rel. zu Kaufpreis
                </MenuItem>
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
                  // MUI wants `undefined`, not `null`, for "no bound"
                  maxDate={dates[1] ?? undefined}
                  onChange={d => handleDateChange([d, dates[1]])}
                  disableFuture
                  disabled={period >= 0}
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
                  disabled={period >= 0}
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
      </ProgressPaper>
    </Container>
  );
};

export default PortfolioPlot;
