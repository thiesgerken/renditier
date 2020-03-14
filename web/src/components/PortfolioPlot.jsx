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
import { Paper, CircularProgress } from '@material-ui/core';

function getData(items, startDate, endDate) {
  let item = null;

  items.forEach(v => {
    if (v.startDate === startDate && v.endDate === endDate) item = v;
  });

  return item;
}

const PortfolioPlot = ({ data, updateData }) => {
  const sd = '2019-01-01';
  const ed = moment().format('YYYY-MM-DD');
  updateData(sd, ed);
  const plotData = getData(data, sd, ed);

  if (
    plotData !== null &&
    plotData.data !== null &&
    plotData.data.points.length > 0
  ) {
    const showDots = plotData.data.points.length < 20;

    return (
      <Paper style={{ width: '100%', height: 300, padding: '1em' }}>
        <ResponsiveContainer>
          <ComposedChart data={plotData.data.points}>
            <XAxis dataKey="date" />
            <YAxis yAxisId="left" unit="€" />
            <YAxis yAxisId="right" orientation="right" unit="€" />

            <CartesianGrid stroke="#eee" strokeDasharray="5 5" />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="invested"
              stroke="#8884d8"
              unit="€"
              dot={showDots}
              name="Investiert"
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="value"
              unit="€"
              stroke="#82ca9d"
              name="Wert"
              dot={showDots}
            />
            {/* <Line
    yAxisId="right"
    type="monotone"
    dataKey="earnings"
    stroke="#ffc658"
    dot={showDots}
  /> */}
            <Area
              yAxisId="right"
              type="monotone"
              dataKey="earnings"
              unit="€"
              stroke="#ffc658"
              fill="#ffc658"
              name="Gewinn"
            />
            {/* <Area stroke="#8884d8" fill="#8884d8" dataKey="earningArea" /> */}

            {/* <Area
    type="monotone"
    dataKey="invested"
    stackId="1"
    stroke="#8884d8"
    fill="#8884d8"
  />
  <Area
    type="monotone"
    dataKey="value"
    stackId="1"
    stroke="#82ca9d"
    fill="#82ca9d"
  /> */}
            {/* <Area type="monotone" dataKey="amt" stackId="1" stroke="#ffc658" fill="#ffc658" /> */}
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
