import { connect } from 'react-redux';
import React from 'react';
import PropTypes from 'prop-types';
import {
  LineChart,
  XAxis,
  YAxis,
  AreaChart,
  Line,
  Tooltip,
  ComposedChart,
  CartesianGrid,
  ResponsiveContainer,
  Area,
} from 'recharts';
import * as moment from 'moment';

import { updatePerformance as updatePerformanceAction } from '../actions/performance';
import { fetchPortfolioPlot as fetchPortfolioPlotAction } from '../actions/portfolio-plot';
import PerformanceTable from '../components/PerformanceTable';
import getPlotData from '../selectors/portfolio-plot';

const Dashboard = ({
  performance,
  updatePerformance,
  getPortfolioPlotData,
  updatePortfolioPlotData,
}) => {
  updatePerformance();

  const sd = '2019-01-01';
  const ed = moment().format('YYYY-MM-DD');
  updatePortfolioPlotData(sd, ed);
  const plotData = getPortfolioPlotData(sd, ed);

  const showDots =
    plotData && plotData.data ? plotData.data.points.length < 20 : false;
  return (
    <>
      {plotData && plotData.data && (
        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer>
            <ComposedChart data={plotData.data.points}>
              <XAxis dataKey="date" />
              {/* <YAxis /> */}
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
        </div>
      )}
      <PerformanceTable performance={performance} />
    </>
  );
};

Dashboard.propTypes = {
  performance: PropTypes.shape({
    items: PropTypes.arrayOf(PropTypes.object),
    lastUpdated: PropTypes.number,
  }).isRequired,
  updatePerformance: PropTypes.func.isRequired,
  getPortfolioPlotData: PropTypes.func.isRequired,
  updatePortfolioPlotData: PropTypes.func.isRequired,
};

const mapDispatchToProps = dispatch => ({
  updatePerformance: () => dispatch(updatePerformanceAction()),
  updatePortfolioPlotData: (startDate, endDate) =>
    dispatch(fetchPortfolioPlotAction(startDate, endDate)),
});

const mapStateToProps = state => {
  const { performance } = state;

  return {
    performance,
    getPortfolioPlotData: (sD, eD) => getPlotData(state, sD, eD),
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(Dashboard);
