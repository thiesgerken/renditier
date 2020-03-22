import {
  CircularProgress,
  Container,
  FormControl,
  Grid,
  InputLabel,
  makeStyles,
  MenuItem,
  Paper,
  Select,
  useMediaQuery,
  useTheme,
} from '@material-ui/core';
import { DatePicker } from '@material-ui/pickers';
import * as moment from 'moment';
import PropTypes from 'prop-types';
import React, { useState } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { getPeriodDescription } from '../selectors/performance';

function getData(items, startDate, endDate) {
  let item = null;

  items.forEach(v => {
    if (v.startDate === startDate && v.endDate === endDate) item = v;
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
  const [mode, setMode] = useState('earningsAbsolute');
  const [startDate, setStartDate] = useState(moment().startOf('year'));
  const [endDate, setEndDate] = useState(moment());
  const [prevRange, setPrevRange] = useState(null);

  const handlePeriodChange = event => {
    setPeriod(event.target.value);
  };

  const handleModeChange = event => {
    setMode(event.target.value);
  };

  let plotData = null;
  if (period < performance.items.length) {
    let sd = null;
    let ed = null;

    if (period >= 0) {
      sd = performance.items[period].start.date;
      ed = performance.items[period].end.date;
    } else {
      sd = startDate.format('YYYY-MM-DD');
      ed = endDate.format('YYYY-MM-DD');
    }

    updateData(sd, ed);
    plotData = getData(data, sd, ed);

    if ((plotData === null || plotData.isFetching) && prevRange !== null) {
      plotData = getData(data, prevRange[0], prevRange[1]);
    } else if (
      prevRange === null ||
      prevRange[0] !== sd ||
      prevRange[1] !== ed
    ) {
      setPrevRange([sd, ed]);
    }
  }

  const progress = (plotData === null ||
    plotData.isFetching ||
    performance.isFetching) && (
    <div
      style={{
        position: 'relative',
        'z-index': 9,
        left: '50%',
        top: '40%',
        transform: 'translate(0%, -50%)',
        width: '100%',
        height: 0,
      }}
    >
      <CircularProgress color="secondary" />
    </div>
  );

  const points =
    plotData !== null && plotData.data !== null ? plotData.data.points : [];

  // to color the areas differently
  const earningsAbsoluteOffset = (() => {
    const dataMax = Math.max(...points.map(i => i.earnings));
    const dataMin = Math.min(...points.map(i => i.earnings));

    if (dataMax <= 0) {
      return 0;
    }
    if (dataMin >= 0) {
      return 1;
    }

    return dataMax / (dataMax - dataMin);
  })();
  const earningsRelativeOffset = (() => {
    const dataMax = Math.max(...points.map(i => i.earningsRelative));
    const dataMin = Math.min(...points.map(i => i.earningsRelative));

    if (dataMax <= 0) {
      return 0;
    }
    if (dataMin >= 0) {
      return 1;
    }

    return dataMax / (dataMax - dataMin);
  })();

  const interpolation = 'monotone';
  const showDots = points.length < 35;
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
      <Paper style={{ width: '100%', padding: theme.spacing(1) }}>
        <Grid container style={{ width: '100%' }}>
          <Grid item xs={12}>
            <div
              style={{ position: 'relative', width: '100%', height: '100%' }}
            >
              {progress}
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  height: '100%',
                }}
              >
                <ResponsiveContainer aspect={mdUp ? 5 : 3} width="100%">
                  <ComposedChart data={points}>
                    <XAxis dataKey="date" />
                    <YAxis
                      unit={mode === 'earningsRelative' ? '%' : '€'}
                      hide={xsDown}
                    />
                    <CartesianGrid strokeDasharray="5 5" />

                    <defs>
                      {[
                        {
                          offset: earningsAbsoluteOffset,
                          name: 'earningsAbsolute',
                        },
                        {
                          offset: earningsRelativeOffset,
                          name: 'earningsRelative',
                        },
                      ].map(({ offset, name }) => (
                        <>
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
                        </>
                      ))}
                    </defs>

                    {mode === 'investedAndValue' && (
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
                    {mode === 'investedAndValue' && (
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

                    {mode === 'earningsAbsolute' && (
                      <Area
                        type={interpolation}
                        dataKey="earnings"
                        unit="€"
                        stroke="url(#earningsAbsoluteColor)"
                        strokeWidth={1.4}
                        fill="url(#earningsAbsoluteFill)"
                        name="Gewinn"
                        dot={dot}
                        activeDot={activeDot}
                      />
                    )}
                    {mode === 'earningsRelative' && (
                      <Area
                        type={interpolation}
                        dataKey="earningsRelative"
                        unit="%"
                        stroke="url(#earningsRelativeColor)"
                        strokeWidth={1.4}
                        fill="url(#earningsRelativeFill)"
                        name="Gewinn"
                        dot={dot}
                        activeDot={activeDot}
                      />
                    )}

                    <Tooltip formatter={v => v.toFixed(2)} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
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
                <MenuItem value="investedAndValue">Kaufpreis und Wert</MenuItem>
                <MenuItem value="earningsAbsolute">Gewinn (absolut)</MenuItem>
                <MenuItem value="earningsRelative">
                  Gewinn (relativ zu Kaufpreis)
                </MenuItem>
              </Select>
            </FormControl>
            <FormControl className={classes.formControl}>
              <InputLabel id="period-select-label">Zeit</InputLabel>
              <Select
                labelId="period-select-label"
                id="period-select"
                autoWidth
                value={
                  performance.items === null || performance.items.length === 0
                    ? -1
                    : period
                }
                onChange={handlePeriodChange}
              >
                {performance.items.map((item, i) => (
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
                <DatePicker
                  label="Start"
                  value={startDate}
                  format="L"
                  maxDate={endDate}
                  onChange={setStartDate}
                  animateYearScrolling
                  disableFuture
                  disabled={period >= 0}
                  className={classes.formControl}
                />
                <DatePicker
                  label="Ende"
                  value={endDate}
                  format="L"
                  minDate={startDate}
                  onChange={setEndDate}
                  animateYearScrolling
                  disableFuture
                  disabled={period >= 0}
                  className={classes.formControl}
                />
              </>
            )}
          </Grid>
        </Grid>
      </Paper>
    </Container>
  );
};

PortfolioPlot.propTypes = {
  data: PropTypes.arrayOf(PropTypes.object).isRequired,
  updateData: PropTypes.func.isRequired,
  performance: PropTypes.shape({
    items: PropTypes.arrayOf(PropTypes.object),
    lastUpdated: PropTypes.number,
    isFetching: PropTypes.bool,
  }).isRequired,
};

export default PortfolioPlot;
