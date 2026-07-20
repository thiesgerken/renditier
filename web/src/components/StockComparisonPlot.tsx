import {
  Container,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  useMediaQuery,
  useTheme,
  Input,
  ListItemText,
  Checkbox,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import moment from 'moment';
import type { Moment } from 'moment';
import { map, every, mapValues, sortBy } from 'lodash';
import type { ReactNode } from 'react';
import { useState, useCallback, useEffect } from 'react';
import {
  Area,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
  AreaChart,
} from 'recharts';
import type { TooltipValueType } from 'recharts';
import {
  red,
  blue,
  deepOrange,
  teal,
  pink,
  lime,
  green,
  deepPurple,
  orange,
} from '@mui/material/colors';

import type { DataSourceSelection, IsoDate, IsoDateTime } from '../types/api';
import type {
  PerformanceState,
  StockPlotItem,
  StocksState,
  StoredStockPlotPoint,
} from '../types/store';
import { getPeriodDescription } from '../selectors/performance';
import ProgressPaper from './ProgressPaper';
import { abbreviateTitle, findStock } from '../selectors/stocks';

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

const ITEM_HEIGHT = 48;
const ITEM_PADDING_TOP = 8;
// FIXME(tsx-migration): this was `PaperProps`, which MUI dropped from Menu's
// props, so the dropdown's height cap and width were silently ignored.
const MenuProps = {
  slotProps: {
    paper: {
      style: {
        maxHeight: ITEM_HEIGHT * 4.5 + ITEM_PADDING_TOP,
        width: 250,
      },
    },
  },
};

const formControlSx = { m: 1, minWidth: 120 };

// One row of the chart's data: the shared timestamp plus one `priceRelStart`
// entry per ISIN, keyed by the ISIN itself.
interface UnifiedPoint {
  date: IsoDateTime | null;
  epoch: number | null;
  [isin: string]: string | number | null;
}

const unifyPoints = (
  points: Record<string, StoredStockPlotPoint[]>,
  isins: string[]
): UnifiedPoint[] => {
  const unifiedPoints: UnifiedPoint[] = [];

  if (points !== null) {
    const idx = map(isins, () => 0);
    let allFinished = false;
    while (!allFinished) {
      let epoch: number | null = null;
      let date: IsoDateTime | null = null;

      for (let i = 0; i < idx.length; i += 1)
        if (points[isins[i]] !== null && idx[i] < points[isins[i]].length) {
          const e = points[isins[i]][idx[i]].epoch;
          const d = points[isins[i]][idx[i]].date;
          if (epoch === null || e < epoch) {
            date = d;
            epoch = e;
          }
        }

      allFinished = date === null;
      if (!allFinished) {
        const rec: UnifiedPoint = { date, epoch };

        for (let i = 0; i < idx.length; i += 1)
          if (points[isins[i]] !== null && idx[i] < points[isins[i]].length) {
            const d = points[isins[i]][idx[i]].date;

            if (d === date) {
              rec[isins[i]] = points[isins[i]][idx[i]].priceRelStart;
              idx[i] += 1;
            } // else if (unifiedPoints.length > 0)
            //   rec[isins[i]] = unifiedPoints[unifiedPoints.length - 1][isins[i]];
            else rec[isins[i]] = null;
          }

        unifiedPoints.push(rec);
      }
    }
  }

  return unifiedPoints;
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
  const theme = useTheme();
  const mdUp = useMediaQuery(theme.breakpoints.up('md'));
  const xsDown = useMediaQuery(theme.breakpoints.down('sm'));
  const [period, setPeriod] = useState(0);
  const [source, setSource] = useState<DataSourceSelection>('auto');
  const [dates, setDates] = useState<[Moment | null, Moment | null]>([
    moment().subtract(2, 'years').startOf('year'),
    moment(),
  ]);
  const [prevRange, setPrevRange] = useState<
    [IsoDate | null, IsoDate | null, DataSourceSelection] | null
  >(null);
  let [isins, setIsins] = useState<string[] | null>(null); // eslint-disable-line prefer-const

  const handlePeriodChange = useCallback((event: SelectChangeEvent<number>) => {
    setPeriod(event.target.value);
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

  const handleIsinChange = (event: SelectChangeEvent<string[]>) => {
    // `multiple` is set, so MUI always reports an array here; the type also
    // covers the single-select case, where the value would be a plain string.
    setIsins(event.target.value as string[]);
  };

  const nextWeekDay = (date: Moment): Moment => {
    let d = moment(date);
    while (d.day() === 0 || d.day() === 6) d = d.add(1, 'days');
    return d;
  };

  const colorNames = [
    teal,
    deepOrange,
    blue,
    orange,
    pink,
    green,
    lime,
    deepPurple,
    red,
  ];
  const colors = colorNames.map(c => c[400]);
  const colorsAccent = colorNames.map(c => c['500']);

  const plotData: Record<string, StockPlotItem | null> = {};

  if (isins === null) {
    isins = [];

    if (performance.data !== null && performance.data.length > 0) {
      isins = map(
        sortBy(
          map(performance.data[0].positions, (p, isin) => ({
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
    if (period >= 0 && period < performance.data.length) {
      sd = nextWeekDay(
        moment(performance.data[period].start.date).add(1, 'days')
      ).format('YYYY-MM-DD');
      ed = performance.data[period].end.date;
    } else {
      // FIXME(tsx-migration): the DatePickers below hand `null` to
      // handleDateChange when their field is cleared, so `dates[0]` / `dates[1]`
      // can be null here and calling .isValid() on them threw a TypeError.
      sd = (
        dates[0] !== null && dates[0].isValid()
          ? dates[0]
          : moment().startOf('year')
      ).format('YYYY-MM-DD');
      ed = (
        dates[1] !== null && dates[1].isValid() ? dates[1] : moment()
      ).format('YYYY-MM-DD');
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

  let axisTimeFormat = 'L';
  // FIXME(tsx-migration): `points` is the object returned by mapValues, so
  // `points.length` was always undefined and neither branch ever ran; the
  // intended subject is the unified list of plotted points.
  if (unifiedPoints.length === 1) {
    axisTimeFormat = 'L LT';
  } else if (unifiedPoints.length >= 2) {
    const fd = moment(unifiedPoints[0].date);
    const ld = moment(unifiedPoints[unifiedPoints.length - 1].date);

    if (fd.isSame(ld, 'year')) axisTimeFormat = 'DD.MM.';

    if (moment.duration(ld.diff(fd)) <= moment.duration(10, 'days'))
      axisTimeFormat += ' LT';
  }

  const interpolation = 'monotone';
  const showDots = false;
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
        loading={
          !every(plotData, p => p !== null && !p.isFetching) ||
          performance.isFetching
        }
        style={{ width: '100%', padding: theme.spacing(1) }}
      >
        <Grid container style={{ width: '100%' }}>
          <Grid size={12}>
            <ResponsiveContainer aspect={mdUp ? 5 : 3} width="100%">
              <AreaChart data={unifiedPoints}>
                <XAxis
                  dataKey="epoch"
                  type="number"
                  scale="utc"
                  domain={['dataMin', 'dataMax']}
                  tickFormatter={(d: number) =>
                    moment(d).format(axisTimeFormat)
                  }
                />
                <YAxis unit="%" hide={xsDown} domain={['auto', 'auto']} />

                <CartesianGrid strokeDasharray="5 5" />

                {map(currentIsins, (isin, i) => {
                  let s = null;
                  let colorIdx = i;

                  if (stocks.data !== null)
                    for (let j = 0; j < stocks.data.length; j += 1)
                      if (stocks.data[j].isin === isin) {
                        s = stocks.data[j];
                        colorIdx = j;
                      }

                  return (
                    <Area
                      type={interpolation}
                      dataKey={isin}
                      unit="%"
                      name={s === null ? isin : abbreviateTitle(s.title, true)}
                      dot={dot}
                      key={isin}
                      activeDot={activeDot}
                      stroke={colorsAccent[colorIdx % colorsAccent.length]}
                      strokeWidth={1.4}
                      fill={colors[colorIdx % colors.length]}
                      fillOpacity={0.2}
                      connectNulls
                    />
                  );
                })}
                <Legend />
                <Tooltip
                  // Every series value is a `priceRelStart`, i.e. a number;
                  // recharts types the argument as the wider ValueType.
                  formatter={(v: TooltipValueType | undefined) =>
                    (v as number).toFixed(2)
                  }
                  // The label is the `epoch` value of the numeric X axis.
                  labelFormatter={(d: ReactNode) =>
                    moment(d as number).format('LLLL')
                  }
                />
              </AreaChart>
            </ResponsiveContainer>
          </Grid>
          <Grid container size={9}>
            <Grid size={3}>
              <FormControl
                variant="standard"
                sx={{ ...formControlSx, width: '100%', pr: 2 }}
                style={{
                  width: '100%',
                  paddingRight: theme.spacing(2),
                }}
              >
                <InputLabel id="isin-checkbox-label">Wertpapiere</InputLabel>
                <Select
                  labelId="isin-checkbox-label"
                  id="isin-checkbox"
                  label="Wertpapiere"
                  multiple
                  value={currentIsins}
                  onChange={handleIsinChange}
                  input={
                    <Input
                      fullWidth
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    />
                  }
                  renderValue={selected => {
                    const selIsins = map(selected, isin => {
                      const s = findStock(stocks, isin);
                      if (s !== null) return abbreviateTitle(s.title, true);
                      return isin;
                    });

                    if (selIsins.length === 0) return '(keine)';
                    if (selIsins.length === 1) return selIsins[0];
                    if (selIsins.length === 2) return selIsins.join(', ');

                    return `${selIsins[0]} und ${selIsins.length - 1} weitere`;
                  }}
                  MenuProps={MenuProps}
                >
                  {stocks.data !== null &&
                    stocks.data.map(s => (
                      <MenuItem key={s.isin} value={s.isin}>
                        <Checkbox checked={currentIsins.indexOf(s.isin) > -1} />
                        <ListItemText
                          primary={abbreviateTitle(s.title, true)}
                        />
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>{' '}
            </Grid>
            <Grid size={9}>
              <FormControl sx={formControlSx} variant="standard">
                <InputLabel id="source-select-label">Datenquelle</InputLabel>
                <Select
                  labelId="source-select-label"
                  id="source-select"
                  label="Datenquelle"
                  value={source}
                  fullWidth
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
                    // `undefined` rather than `null`: an empty field means "no bound".
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
        </Grid>
      </ProgressPaper>
    </Container>
  );
};

export default StockComparisonPlot;
