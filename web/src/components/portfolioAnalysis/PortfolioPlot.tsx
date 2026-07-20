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
import type { Moment } from 'moment';
import { useState, Fragment, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TooltipValueType } from 'recharts';

import type { DataSourceSelection, IsoDate } from '../../types/api';
import type {
  PerformanceState,
  PortfolioPlotItem,
  StoredPortfolioPlotPoint,
} from '../../types/store';
import { getPeriodDescription } from '../../selectors/performance';
import ProgressPaper from '../ProgressPaper';

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
  const mdUp = useMediaQuery(theme.breakpoints.up('md'));
  const xsDown = useMediaQuery(theme.breakpoints.down('sm'));
  const [period, setPeriod] = useState(0);
  const [mode, setMode] = useState('earnings');
  const [source, setSource] = useState<DataSourceSelection>('auto');
  const [dates, setDates] = useState<[Moment | null, Moment | null]>([
    moment().startOf('year'),
    moment(),
  ]);
  const [prevRange, setPrevRange] = useState<PlotRange | null>(null);

  const handlePeriodChange = useCallback((event: SelectChangeEvent<number>) => {
    setPeriod(event.target.value);
  }, []);

  const handleModeChange = useCallback((event: SelectChangeEvent<string>) => {
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

  const nextWeekDay = (date: Moment | string): Moment => {
    let d = moment(date);
    while (d.day() === 0 || d.day() === 6) d = d.add(1, 'days');
    return d;
  };

  let plotData: PortfolioPlotItem | null = null;
  let sd: IsoDate | null = null;
  let ed: IsoDate | null = null;

  if (performance.data !== null && period < performance.data.length) {
    if (period >= 0) {
      sd = nextWeekDay(
        moment(performance.data[period].start.date).add(1, 'days')
      ).format('YYYY-MM-DD');
      ed = performance.data[period].end.date;
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

  const points: StoredPortfolioPlotPoint[] =
    plotData !== null && plotData.data !== null ? plotData.data.points : [];

  let axisTimeFormat = 'L';
  if (points.length === 1) {
    axisTimeFormat = 'L LT';
  } else if (points.length >= 2) {
    const fd = moment(points[0].date);
    const ld = moment(points[points.length - 1].date);

    if (fd.isSame(ld, 'year')) axisTimeFormat = 'DD.MM.';

    // `ld - fd` in the original; Moment coerces to epoch millis via valueOf().
    if (
      moment.duration(ld.valueOf() - fd.valueOf()) <=
      moment.duration(10, 'days')
    )
      axisTimeFormat += ' LT';
  }

  // to color the areas differently
  const makeOffset = (
    f: (point: StoredPortfolioPlotPoint) => number | null
  ) => {
    // The derived fields are nullable; Math.max/min turned `null` into 0 in the
    // original, which `?? 0` reproduces.
    const values = points.map(p => f(p) ?? 0);
    const dataMax = Math.max(...values);
    const dataMin = Math.min(...values);

    if (dataMax <= 0) {
      return 0;
    }
    if (dataMin >= 0) {
      return 1;
    }

    return dataMax / (dataMax - dataMin);
  };

  const earningsOffset = makeOffset(i => i.earnings);
  const earningsRelInvestedOffset = makeOffset(i => i.earningsRelInvested);
  const valueRelStartOffset = makeOffset(i => i.valueRelStart);
  const investedRelStartOffset = makeOffset(i => i.investedRelStart);

  const interpolation = 'monotone';
  const showDots = points.length < 100;
  const dot = showDots
    ? {
        stroke: '#00000033',
        strokeWidth: 1,
        fill: '#00000033',
      }
    : false;

  const activeDot = {
    stroke: '#00000033',
    strokeWidth: 1,
    fill: '#eeeeee',
  };

  return (
    <Container maxWidth="xl" style={{ padding: '0px' }}>
      <ProgressPaper
        style={{ width: '100%', padding: theme.spacing(1) }}
        loading={
          plotData === null || plotData.isFetching || performance.isFetching
        }
      >
        <Grid container style={{ width: '100%' }}>
          <Grid size={12}>
            <ResponsiveContainer aspect={mdUp ? 5 : 3} width="100%">
              <ComposedChart data={points}>
                <XAxis
                  dataKey="epoch"
                  type="number"
                  scale="utc"
                  domain={['dataMin', 'dataMax']}
                  tickFormatter={(d: number) =>
                    moment(d).format(axisTimeFormat)
                  }
                />
                <YAxis
                  unit={mode.indexOf('Rel') >= 0 ? '%' : '€'}
                  domain={['auto', 'auto']}
                  hide={xsDown}
                />
                <CartesianGrid strokeDasharray="5 5" />

                <defs>
                  {[
                    {
                      offset: earningsOffset,
                      name: 'earnings',
                    },
                    {
                      offset: earningsRelInvestedOffset,
                      name: 'earningsRelInvested',
                    },
                    {
                      offset: valueRelStartOffset,
                      name: 'valueRelStart',
                    },
                    {
                      offset: investedRelStartOffset,
                      name: 'investedRelStart',
                    },
                  ].map(({ offset, name }) => (
                    <Fragment key={name}>
                      <linearGradient
                        id={`${name}Color`}
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset={offset}
                          stopColor={theme.palette.primary.dark}
                          stopOpacity={1}
                        />
                        <stop
                          offset={offset}
                          stopColor={theme.palette.secondary.dark}
                          stopOpacity={1}
                        />
                      </linearGradient>
                      <linearGradient
                        id={`${name}Fill`}
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset={offset}
                          stopColor={theme.palette.primary.main}
                          stopOpacity={0.8}
                        />
                        <stop
                          offset={offset}
                          stopColor={theme.palette.secondary.main}
                          stopOpacity={0.8}
                        />
                      </linearGradient>
                    </Fragment>
                  ))}
                </defs>

                {(mode === 'investedAndValue' || mode === 'invested') && (
                  <Area
                    type={interpolation}
                    dataKey="invested"
                    stroke={theme.palette.secondary.dark}
                    fill={theme.palette.secondary.main}
                    strokeWidth={1.4}
                    unit="€"
                    dot={dot}
                    activeDot={activeDot}
                    name="Investiert"
                    fillOpacity={0.2}
                  />
                )}

                {(mode === 'investedAndValue' || mode === 'value') && (
                  <Area
                    type={interpolation}
                    dataKey="value"
                    unit="€"
                    stroke={theme.palette.primary.dark}
                    fill={theme.palette.primary.main}
                    strokeWidth={1.4}
                    name="Wert"
                    dot={dot}
                    activeDot={activeDot}
                    fillOpacity={0.2}
                  />
                )}

                {mode === 'earnings' && (
                  <Area
                    type={interpolation}
                    dataKey="earnings"
                    unit="€"
                    stroke="url(#earningsColor)"
                    strokeWidth={1.4}
                    fill="url(#earningsFill)"
                    name="Gewinn"
                    dot={dot}
                    activeDot={activeDot}
                    fillOpacity={0.2}
                  />
                )}

                {mode === 'valueRelStart' && (
                  <Area
                    type={interpolation}
                    dataKey="valueRelStart"
                    unit="%"
                    stroke="url(#valueRelStartColor)"
                    strokeWidth={1.4}
                    fill="url(#valueRelStartFill)"
                    name="Wertveränderung"
                    dot={dot}
                    activeDot={activeDot}
                    fillOpacity={0.2}
                  />
                )}

                {mode === 'investedRelStart' && (
                  <Area
                    type={interpolation}
                    dataKey="investedRelStart"
                    unit="%"
                    stroke="url(#investedRelStartColor)"
                    strokeWidth={1.4}
                    fill="url(#investedRelStartFill)"
                    name="Kaufpreisveränderung"
                    dot={dot}
                    activeDot={activeDot}
                    fillOpacity={0.2}
                  />
                )}

                {mode === 'earningsRelInvested' && (
                  <Area
                    type={interpolation}
                    dataKey="earningsRelInvested"
                    unit="%"
                    stroke="url(#earningsRelInvestedColor)"
                    strokeWidth={1.4}
                    fill="url(#earningsRelInvestedFill)"
                    name="Gewinn rel. Kaufpreis"
                    dot={dot}
                    activeDot={activeDot}
                    fillOpacity={0.2}
                  />
                )}

                <Tooltip
                  // every series plotted here is numeric
                  formatter={(v: TooltipValueType | undefined) =>
                    (v as number).toFixed(2)
                  }
                  // the label is the `epoch` value of the XAxis
                  labelFormatter={(d: ReactNode) =>
                    moment(d as number).format('LLLL')
                  }
                />
              </ComposedChart>
            </ResponsiveContainer>
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
                  format="DD/MM/YYYY"
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
                  format="DD/MM/YYYY"
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
