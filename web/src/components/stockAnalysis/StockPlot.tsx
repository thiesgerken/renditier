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

import { getPeriodDescription } from '../../selectors/performance';
import StockTooltipContent from './StockTooltipContent';
import ProgressPaper from '../ProgressPaper';
import type { DataSourceSelection, IsoDate } from '../../types/api';
import type {
  PerformanceState,
  StockPlotItem,
  StoredStockPlotPoint,
} from '../../types/store';

interface Props {
  isin: string;
  performance: PerformanceState;
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

const StockPlot = ({ isin, performance, data, updateData }: Props) => {
  const theme = useTheme();
  const mdUp = useMediaQuery(theme.breakpoints.up('md'));
  const xsDown = useMediaQuery(theme.breakpoints.down('sm'));
  const [period, setPeriod] = useState(0);
  const [mode, setMode] = useState('priceAndUnits');
  const [source, setSource] = useState<DataSourceSelection>('auto');
  const [dates, setDates] = useState<moment.Moment[]>([
    moment().startOf('year'),
    moment(),
  ]);
  const [prevRange, setPrevRange] = useState<Range | null>(null);

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

  const handleDateChange = useCallback((v: moment.Moment[]) => {
    setDates(v);
  }, []);

  const nextWeekDay = (date: moment.MomentInput) => {
    let d = moment(date);
    while (d.day() === 0 || d.day() === 6) d = d.add(1, 'days');
    return d;
  };

  let plotData: StockPlotItem | null = null;
  let sd: IsoDate | null = null;
  let ed: IsoDate | null = null;

  if (performance.data !== null && period < performance.data.length) {
    if (period >= 0) {
      sd = nextWeekDay(
        moment(performance.data[period].start.date).add(1, 'days')
      ).format('YYYY-MM-DD');
      ed = performance.data[period].end.date;
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

  const points: StoredStockPlotPoint[] =
    plotData !== null && plotData.data !== null ? plotData.data.points : [];

  let axisTimeFormat = 'L';
  if (points.length === 1) {
    axisTimeFormat = 'L LT';
  } else if (points.length >= 2) {
    const fd = moment(points[0].date);
    const ld = moment(points[points.length - 1].date);

    if (fd.isSame(ld, 'year')) axisTimeFormat = 'DD.MM.';

    // `.valueOf()` is what the original `ld - fd` relied on implicitly.
    if (
      moment.duration(ld.valueOf() - fd.valueOf()) <=
      moment.duration(10, 'days')
    )
      axisTimeFormat += ' LT';
  }

  // to color the areas differently
  const makeOffset = (f: (point: StoredStockPlotPoint) => number | null) => {
    // `?? 0` reproduces the original coercion of null to 0 inside Math.max/min.
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
  const earningsRelInvestmentOffset = makeOffset(i => i.earningsRelInvestment);
  const valueRelStartOffset = makeOffset(i => i.valueRelStart);
  const investedRelStartOffset = makeOffset(i => i.investedRelStart);
  const priceRelStartOffset = makeOffset(i => i.priceRelStart);

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

  let unit = '';
  if (mode.indexOf('Rel') >= 0) unit = '%';
  else if (mode !== 'units') unit = '€';

  return (
    <Container maxWidth="xl" style={{ padding: '0px' }}>
      <ProgressPaper
        loading={
          plotData === null || plotData.isFetching || performance.isFetching
        }
        style={{ width: '100%', padding: theme.spacing(1) }}
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
                <YAxis unit={unit} hide={xsDown} domain={['auto', 'auto']} />
                <CartesianGrid strokeDasharray="5 5" />
                <defs>
                  {[
                    {
                      offset: earningsOffset,
                      name: 'earnings',
                    },
                    {
                      offset: earningsRelInvestmentOffset,
                      name: 'earningsRelInvestment',
                    },
                    {
                      offset: valueRelStartOffset,
                      name: 'valueRelStart',
                    },
                    {
                      offset: investedRelStartOffset,
                      name: 'investedRelStart',
                    },
                    {
                      offset: priceRelStartOffset,
                      name: 'priceRelStart',
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
                    stroke={
                      mode === 'investedAndValue'
                        ? theme.palette.secondary.dark
                        : theme.palette.info.dark
                    }
                    fill={
                      mode === 'investedAndValue'
                        ? theme.palette.secondary.main
                        : theme.palette.info.main
                    }
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
                    stroke={
                      mode === 'investedAndValue'
                        ? theme.palette.primary.dark
                        : theme.palette.info.dark
                    }
                    fill={
                      mode === 'investedAndValue'
                        ? theme.palette.primary.main
                        : theme.palette.info.main
                    }
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

                {(mode === 'price' || mode === 'priceAndUnits') && (
                  <Area
                    type={interpolation}
                    dataKey="price"
                    unit="€"
                    stroke={theme.palette.info.dark}
                    fill={theme.palette.info.main}
                    strokeWidth={1.4}
                    name="Kurs"
                    dot={dot}
                    activeDot={activeDot}
                    fillOpacity={0.2}
                  />
                )}

                {mode === 'units' && (
                  <Area
                    type={interpolation}
                    dataKey="units"
                    unit=""
                    stroke={theme.palette.info.dark}
                    fill={theme.palette.info.main}
                    strokeWidth={1.4}
                    name="Einheiten"
                    dot={dot}
                    activeDot={activeDot}
                    fillOpacity={0.2}
                  />
                )}

                {mode === 'priceAndUnits' && (
                  <Area
                    type={interpolation}
                    dataKey="units"
                    unit=""
                    stroke={theme.palette.warning.dark}
                    fill={theme.palette.warning.main}
                    strokeWidth={1.4}
                    name="Einheiten"
                    yAxisId={1}
                    dot={dot}
                    activeDot={activeDot}
                    fillOpacity={0.2}
                  />
                )}

                {mode === 'priceAndUnits' && (
                  <YAxis
                    unit=""
                    yAxisId={1}
                    hide={xsDown}
                    orientation="right"
                    domain={['auto', 'auto']}
                  />
                )}

                {mode === 'priceRelStart' && (
                  <Area
                    type={interpolation}
                    dataKey="priceRelStart"
                    unit="%"
                    stroke="url(#priceRelStartColor)"
                    fill="url(#priceRelStartFill)"
                    strokeWidth={1.4}
                    name="Kursveränderung"
                    dot={dot}
                    activeDot={activeDot}
                    fillOpacity={0.2}
                  />
                )}

                {mode === 'earningsRelInvestment' && (
                  <Area
                    type={interpolation}
                    dataKey="earningsRelInvestment"
                    unit="%"
                    stroke="url(#earningsRelInvestmentColor)"
                    strokeWidth={1.4}
                    fill="url(#earningsRelInvestmentFill)"
                    name="Gewinn rel. zu Kaufpreis"
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
                    name="Gewinnveränderung"
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

                <Tooltip
                  content={
                    <StockTooltipContent
                      showPriceDate={
                        ['units', 'investedRelStart', 'invested'].indexOf(
                          mode
                        ) < 0
                      }
                    />
                  }
                  // every series plotted here is numeric
                  formatter={v => (v as number).toFixed(2)}
                  // the tooltip label is the `epoch` dataKey, i.e. a number
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
                <MenuItem value="price">Kurs</MenuItem>
                <MenuItem value="priceRelStart">Kursveränderung</MenuItem>
                <MenuItem value="units">Einheiten</MenuItem>
                <MenuItem value="priceAndUnits">Kurs und Einheiten</MenuItem>
                <MenuItem value="investedAndValue">Kaufpreis und Wert</MenuItem>
                <MenuItem value="value">Wert</MenuItem>
                <MenuItem value="valueRelStart">Wertveränderung</MenuItem>
                <MenuItem value="invested">Kaufpreis</MenuItem>
                <MenuItem value="investedRelStart">
                  Kaufpreisveränderung
                </MenuItem>
                <MenuItem value="earnings">Gewinn</MenuItem>
                <MenuItem value="earningsRelInvestment">
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
                  format="DD/MM/YYYY"
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
