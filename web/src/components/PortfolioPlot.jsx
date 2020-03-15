import {
  XAxis,
  YAxis,
  Line,
  Tooltip,
  ComposedChart,
  CartesianGrid,
  ResponsiveContainer,
  Area,
} from 'recharts';
import React from 'react';
import PropTypes from 'prop-types';
import * as moment from 'moment';
import { Paper, CircularProgress, useTheme } from '@material-ui/core';

function getData(items, startDate, endDate) {
  let item = null;

  items.forEach(v => {
    if (v.startDate === startDate && v.endDate === endDate) item = v;
  });

  return item;
}

// TODO: make timespan customizable; allow zooming
// TODO: make what is shown customizable

const PortfolioPlot = ({ data, updateData }) => {
  const theme = useTheme();

  const sd = '2019-01-01';
  const ed = moment().format('YYYY-MM-DD');
  updateData(sd, ed);
  const plotData = getData(data, sd, ed);

  const showDiff = true;

  if (
    plotData !== null &&
    plotData.data !== null &&
    plotData.data.points.length > 0
  ) {
    const showDots = plotData.data.points.length < 100;

    // to color the areas differently
    const off = (() => {
      const dataMax = Math.max(...plotData.data.points.map(i => i.earnings));
      const dataMin = Math.min(...plotData.data.points.map(i => i.earnings));

      if (dataMax <= 0) {
        return 0;
      }
      if (dataMin >= 0) {
        return 1;
      }

      return dataMax / (dataMax - dataMin);
    })();

    return (
      <Paper style={{ width: '100%', height: 300, padding: '1em' }}>
        <ResponsiveContainer>
          <ComposedChart data={plotData.data.points}>
            <XAxis dataKey="date" />
            <YAxis unit="€" />
            <CartesianGrid strokeDasharray="5 5" />

            <defs>
              <linearGradient id="splitColor" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset={off}
                  stopColor={theme.palette.primary.dark}
                  stopOpacity={1}
                />
                <stop
                  offset={off}
                  stopColor={theme.palette.secondary.dark}
                  stopOpacity={1}
                />
              </linearGradient>
              <linearGradient id="splitFill" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset={off}
                  stopColor={theme.palette.primary.main}
                  stopOpacity={0.8}
                />
                <stop
                  offset={off}
                  stopColor={theme.palette.secondary.main}
                  stopOpacity={0.8}
                />
              </linearGradient>
            </defs>

            {showDiff || (
              <>
                <Line
                  type="monotone"
                  dataKey="invested"
                  stroke="#8884d8"
                  unit="€"
                  dot={showDots}
                  name="Investiert"
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  unit="€"
                  stroke="#82ca9d"
                  name="Wert"
                  dot={showDots}
                />
              </>
            )}

            {showDiff && (
              <Area
                type="monotone"
                dataKey="earnings"
                unit="€"
                // stroke="#eeeeee"
                // fill="#ffc658"
                stroke="url(#splitColor)"
                strokeWidth={1.4}
                fill="url(#splitFill)"
                name="Gewinn"
                dot={
                  showDots
                    ? { stroke: '#00000033', strokeWidth: 1, fill: '#00000033' }
                    : false
                }
                activeDot={{
                  stroke: '#00000033',
                  strokeWidth: 1,
                  fill: '#eeeeee',
                }}
              />
            )}

            <Tooltip formatter={v => v.toFixed(2)} />
          </ComposedChart>
        </ResponsiveContainer>
      </Paper>
    );
  }

  if (plotData !== null && plotData.isFetching) {
    return (
      <Paper style={{ width: '100%', height: 300 }}>
        <div
          style={{
            position: 'relative',
            left: '50%',
            top: '50%',
            transform: 'translate(0%, -50%)',
            width: '100%',
          }}
        >
          <CircularProgress color="secondary" />
        </div>
      </Paper>
    );
  }

  return <></>;
};

PortfolioPlot.propTypes = {
  data: PropTypes.arrayOf(PropTypes.object).isRequired,
  updateData: PropTypes.func.isRequired,
};

export default PortfolioPlot;
