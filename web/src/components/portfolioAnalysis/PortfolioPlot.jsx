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
  TextField,
} from '@material-ui/core';
import { DatePicker } from '@material-ui/pickers';
import * as moment from 'moment';
import PropTypes from 'prop-types';
import React, { useState, Fragment, useCallback, useEffect } from 'react';
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
import ProgressPaper from '../ProgressPaper';

function getData(items, startDate, endDate, source) {
  let item = null;

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

const useStyles = makeStyles(theme => ({
  formControl: {
    margin: theme.spacing(1),
    minWidth: 120,
  },
  selectEmpty: {
    marginTop: theme.spacing(2),
  },
}));

const PortfolioPlot = ({ performance, data, updateData }) => {
  const classes = useStyles();
  const theme = useTheme();
  const mdUp = useMediaQuery(theme.breakpoints.up('md'));
  const xsDown = useMediaQuery(theme.breakpoints.down('xs'));
  const [period, setPeriod] = useState(0);
  const [mode, setMode] = useState('earnings');
  const [source, setSource] = useState('auto');
  const [dates, setDates] = useState([moment().startOf('year'), moment()]);
  const [prevRange, setPrevRange] = useState(null);

  const handlePeriodChange = useCallback(event => {
    setPeriod(event.target.value);
  }, []);

  const handleModeChange = useCallback(event => {
    setMode(event.target.value);
  }, []);

  const handleSourceChange = useCallback(event => {
    setSource(event.target.value);
  }, []);

  const handleDateChange = useCallback(v => {
    setDates(v);
  }, []);

  const nextWeekDay = date => {
    let d = moment(date);
    while (d.day() === 0 || d.day() === 6) d = d.add(1, 'days');
    return d;
  };

  let plotData = null;
  let sd = null;
  let ed = null;

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

  const points =
    plotData !== null && plotData.data !== null ? plotData.data.points : [];

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

  // to color the areas differently
  const makeOffset = f => {
    const dataMax = Math.max(...points.map(f));
    const dataMin = Math.min(...points.map(f));

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
          <Grid item xs={12}>
            <ResponsiveContainer aspect={mdUp ? 5 : 3} width="100%">
              <ComposedChart data={points}>
                <XAxis
                  dataKey="epoch"
                  type="number"
                  scale="utc"
                  domain={['dataMin', 'dataMax']}
                  tickFormatter={d => moment(d).format(axisTimeFormat)}
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
                  formatter={v => v.toFixed(2)}
                  labelFormatter={d => moment(d).format('LLLL')}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </Grid>
          <Grid item xs={9}>
            <FormControl className={classes.formControl}>
              <InputLabel id="mode-select-label">Art</InputLabel>
              <Select
                labelId="mode-select-label"
                id="mode-select"
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
            <FormControl className={classes.formControl}>
              <InputLabel id="source-select-label">Datenquelle</InputLabel>
              <Select
                labelId="source-select-label"
                id="source-select"
                value={source}
                autoWidth
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
      </ProgressPaper>
    </Container>
  );
};

PortfolioPlot.propTypes = {
  data: PropTypes.arrayOf(PropTypes.object).isRequired,
  updateData: PropTypes.func.isRequired,
  performance: PropTypes.shape({
    data: PropTypes.arrayOf(PropTypes.object),
    isFetching: PropTypes.bool,
  }).isRequired,
};

export default PortfolioPlot;
