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
import { useState, useCallback, useEffect } from 'react';
import { CartesianGrid, ComposedChart, Legend, Line, YAxis } from 'recharts';
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
  const xsDown = useMediaQuery(theme.breakpoints.down('sm'));
  const [period, setPeriod] = useState(0);
  const [source, setSource] = useState<DataSourceSelection>('auto');
  const [logScale, setLogScale] = useState(true);
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

  const handleScaleChange = useCallback((event: SelectChangeEvent) => {
    setLogScale(event.target.value === 'log');
  }, []);

  const handleDateChange = useCallback((v: [Moment | null, Moment | null]) => {
    setDates(v);
  }, []);

  const handleIsinChange = (event: SelectChangeEvent<string[]>) => {
    // `multiple` is set, so MUI always reports an array here; the type also
    // covers the single-select case, where the value would be a plain string.
    setIsins(event.target.value as string[]);
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
      [sd, ed] = getPeriodRange(performance.data[period]);
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
    return colorsAccent[(idx >= 0 ? idx : i) % colorsAccent.length];
  };

  const loading =
    !every(plotData, p => p !== null && !p.isFetching) ||
    performance.isFetching;

  return (
    <Container maxWidth="xl" style={{ padding: '0px' }}>
      <ProgressPaper
        loading={loading}
        style={{ width: '100%', padding: theme.spacing(1) }}
      >
        <Grid container style={{ width: '100%' }}>
          <Grid size={12}>
            <PlotArea isEmpty={chartPoints.length === 0} isLoading={loading}>
              <ComposedChart data={chartPoints}>
                {timeXAxis(epochs)}
                <YAxis
                  scale={logScale ? 'log' : 'auto'}
                  domain={yAxis.domain}
                  ticks={yAxis.ticks}
                  allowDataOverflow={logScale}
                  tickFormatter={logScale ? growthFactorTick : percentTick}
                  width={90}
                  hide={xsDown}
                />
                <CartesianGrid
                  vertical={false}
                  stroke={theme.palette.divider}
                />

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
              </ComposedChart>
            </PlotArea>
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
                <InputLabel id="scale-select-label">Skala</InputLabel>
                <Select
                  labelId="scale-select-label"
                  id="scale-select"
                  label="Skala"
                  value={logScale ? 'log' : 'linear'}
                  onChange={handleScaleChange}
                >
                  <MenuItem value="log">Logarithmisch</MenuItem>
                  <MenuItem value="linear">Linear</MenuItem>
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
                    format="L"
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
