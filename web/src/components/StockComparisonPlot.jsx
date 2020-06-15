import {
  Container,
  FormControl,
  Grid,
  InputLabel,
  makeStyles,
  MenuItem,
  Select,
  useMediaQuery,
  useTheme,
  Input,
  ListItemText,
  Checkbox,
  TextField,
} from '@material-ui/core';
import { DatePicker } from '@material-ui/pickers';
import * as moment from 'moment';
import { map, every, mapValues, sortBy } from 'lodash';
import PropTypes from 'prop-types';
import React, { useState, useCallback, useEffect } from 'react';
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
} from '@material-ui/core/colors';

import { getPeriodDescription } from '../selectors/performance';
import ProgressPaper from './ProgressPaper';
import { abbreviateTitle, findStock } from '../selectors/stocks';

function getData(items, isin, startDate, endDate, source) {
  let item = null;

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
const MenuProps = {
  PaperProps: {
    style: {
      maxHeight: ITEM_HEIGHT * 4.5 + ITEM_PADDING_TOP,
      width: 250,
    },
  },
};

const useStyles = makeStyles(theme => ({
  formControl: {
    margin: theme.spacing(1),
    minWidth: 120,
  },
  selectEmpty: {
    marginTop: theme.spacing(2),
  },
}));

const unifyPoints = (points, isins) => {
  const unifiedPoints = [];

  if (points !== null) {
    const idx = map(isins, () => 0);
    let allFinished = false;
    while (!allFinished) {
      let epoch = null;
      let date = null;

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
        const rec = {};
        rec.date = date;
        rec.epoch = epoch;

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

const StockComparisonPlot = ({ stocks, performance, data, updateData }) => {
  const classes = useStyles();
  const theme = useTheme();
  const mdUp = useMediaQuery(theme.breakpoints.up('md'));
  const xsDown = useMediaQuery(theme.breakpoints.down('xs'));
  const [period, setPeriod] = useState(0);
  const [source, setSource] = useState('auto');
  const [dates, setDates] = useState([
    moment().subtract(2, 'years').startOf('year'),
    moment(),
  ]);
  const [prevRange, setPrevRange] = useState(null);
  let [isins, setIsins] = useState(null); // eslint-disable-line prefer-const

  const handlePeriodChange = useCallback(event => {
    setPeriod(event.target.value);
  }, []);

  const handleSourceChange = useCallback(event => {
    setSource(event.target.value);
  }, []);

  const handleDateChange = useCallback(v => {
    setDates(v);
  }, []);

  const handleIsinChange = event => {
    setIsins(event.target.value);
  };

  const nextWeekDay = date => {
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

  const plotData = {};

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

  isins.forEach(isin => {
    plotData[isin] = null;
  });

  let sd = null;
  let ed = null;

  if (performance.data !== null) {
    if (period >= 0 && period < performance.data.length) {
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

    isins.forEach(isin => {
      plotData[isin] = getData(data, isin, sd, ed, source);

      if (
        (plotData[isin] === null || plotData[isin].isFetching) &&
        prevRange !== null
      ) {
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
    isins.forEach(isin => updateData(isin, sd, ed, source));
    return undefined;
  }, [isins, sd, ed, source, updateData]);

  const points = mapValues(plotData, v =>
    v !== null && v.data !== null ? v.data.points : []
  );
  const unifiedPoints = unifyPoints(points, isins);

  let axisTimeFormat = 'L';
  if (points.length === 1) {
    axisTimeFormat = 'L LT';
  } else if (points.length >= 2) {
    const fd = moment(points[0].date);
    const ld = moment(points[points.length - 1].date);

    if (fd.isSame(ld, 'year')) axisTimeFormat = 'DD.MM.';

    if (moment.duration(ld - fd) <= moment.duration(10, 'days'))
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
          <Grid item xs={12}>
            <ResponsiveContainer aspect={mdUp ? 5 : 3} width="100%">
              <AreaChart data={unifiedPoints}>
                <XAxis
                  dataKey="epoch"
                  type="number"
                  scale="utc"
                  domain={['dataMin', 'dataMax']}
                  tickFormatter={d => moment(d).format(axisTimeFormat)}
                />
                <YAxis unit="%" hide={xsDown} domain={['auto', 'auto']} />

                <CartesianGrid strokeDasharray="5 5" />

                {map(isins, (isin, i) => {
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
                  formatter={v => v.toFixed(2)}
                  labelFormatter={d => moment(d).format('LLLL')}
                />
              </AreaChart>
            </ResponsiveContainer>
          </Grid>
          <Grid container item xs={9}>
            <Grid item xs={3}>
              <FormControl
                className={classes.formControl}
                style={{
                  width: '100%',
                  paddingRight: theme.spacing(2),
                }}
              >
                <InputLabel id="isin-checkbox-label">Wertpapiere</InputLabel>
                <Select
                  labelId="isin-checkbox-label"
                  id="isin-checkbox"
                  multiple
                  value={isins}
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
                        <Checkbox checked={isins.indexOf(s.isin) > -1} />
                        <ListItemText
                          primary={abbreviateTitle(s.title, true)}
                        />
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>{' '}
            </Grid>
            <Grid item xs={9}>
              <FormControl className={classes.formControl}>
                <InputLabel id="source-select-label">Datenquelle</InputLabel>
                <Select
                  labelId="source-select-label"
                  id="source-select"
                  value={source}
                  fullWidth
                  onChange={handleSourceChange}
                >
                  <MenuItem value="auto">Automatisch</MenuItem>
                  <MenuItem value="historical">Historisch</MenuItem>
                  <MenuItem value="realtime">Echtzeit</MenuItem>
                </Select>
              </FormControl>
              <FormControl className={classes.formControl}>
                <InputLabel id="period-select-label">Zeit</InputLabel>
                <Select
                  labelId="period-select-label"
                  id="period-select"
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
                  className={classes.formControl}
                /> */}
                  <DatePicker
                    label="Start"
                    renderInput={props => (
                      <FormControl className={classes.formControl}>
                        <TextField /* eslint-disable react/jsx-props-no-spreading */
                          {...props}
                          helperText={null}
                        />
                      </FormControl>
                    )}
                    value={dates[0]}
                    inputFormat="DD/MM/YYYY"
                    maxDate={dates[1]}
                    onChange={d => handleDateChange([d, dates[1]])}
                    disableFuture
                    autoOk
                    disabled={period >= 0}
                  />
                  <DatePicker
                    label="Ende"
                    renderInput={props => (
                      <FormControl className={classes.formControl}>
                        <TextField /* eslint-disable react/jsx-props-no-spreading */
                          {...props}
                          helperText={null}
                        />
                      </FormControl>
                    )}
                    value={dates[1]}
                    inputFormat="DD/MM/YYYY"
                    minDate={dates[0]}
                    onChange={d => handleDateChange([dates[0], d])}
                    disableFuture
                    autoOk
                    disabled={period >= 0}
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

StockComparisonPlot.propTypes = {
  data: PropTypes.arrayOf(PropTypes.object).isRequired,
  updateData: PropTypes.func.isRequired,
  performance: PropTypes.shape({
    data: PropTypes.arrayOf(PropTypes.object),
    isFetching: PropTypes.bool,
  }).isRequired,
  stocks: PropTypes.shape({
    data: PropTypes.arrayOf(PropTypes.object),
    isFetching: PropTypes.bool,
  }).isRequired,
};

export default StockComparisonPlot;
