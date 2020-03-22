import { connect } from 'react-redux';
import React from 'react';
import PropTypes from 'prop-types';
import { Grid, Hidden } from '@material-ui/core';

import { updatePerformance as updatePerformanceAction } from '../actions/performance';
import { updatePortfolioPlot as updatePortfolioPlotAction } from '../actions/portfolio-plot';
import PerformanceTable from '../components/PerformanceTable';
import PortfolioPlot from '../components/PortfolioPlot';
import PositionsTable from '../components/PositionsTable';

const Dashboard = ({
  performance,
  updatePerformance,
  portfolioPlotData,
  updatePortfolioPlotData,
}) => {
  updatePerformance();

  return (
    <Grid container spacing={3}>
      <Hidden xsDown implementation="js">
        <Grid item xs={12} style={{ padding: '4px' }}>
          <PortfolioPlot
            data={portfolioPlotData}
            updateData={updatePortfolioPlotData}
            performance={performance}
          />
        </Grid>
      </Hidden>
      <Grid item xs={12} style={{ padding: '4px' }}>
        <PerformanceTable performance={performance} />
      </Grid>
      <Grid item xs={12} style={{ padding: '4px' }}>
        <PositionsTable performance={performance} />
      </Grid>
    </Grid>
  );
};

Dashboard.propTypes = {
  performance: PropTypes.shape({
    items: PropTypes.arrayOf(PropTypes.object),
    lastUpdated: PropTypes.number,
  }).isRequired,
  updatePerformance: PropTypes.func.isRequired,
  portfolioPlotData: PropTypes.arrayOf(PropTypes.object).isRequired,
  updatePortfolioPlotData: PropTypes.func.isRequired,
};

const mapDispatchToProps = dispatch => ({
  updatePerformance: () => dispatch(updatePerformanceAction()),
  updatePortfolioPlotData: (startDate, endDate) =>
    dispatch(updatePortfolioPlotAction(startDate, endDate)),
});

const mapStateToProps = state => {
  const { performance, portfolioPlot } = state;

  return {
    performance,
    portfolioPlotData: portfolioPlot.items,
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(Dashboard);
