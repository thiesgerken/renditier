import { connect } from 'react-redux';
import React from 'react';
import PropTypes from 'prop-types';
import {
  Grid,
  Hidden,
  Typography,
  Container,
  Paper,
  useTheme,
} from '@material-ui/core';
import { find, filter, max, min, map } from 'lodash';
import * as moment from 'moment';
import { push as routerPush } from 'connected-react-router';

import { updatePerformance as updatePerformanceAction } from '../actions/performance';
import { updatePortfolioPlot as updatePortfolioPlotAction } from '../actions/portfolioPlot';
import { updateStocks as updateStocksAction } from '../actions/stocks';
import PerformanceTable from '../components/PerformanceTable';
import PortfolioPlot from '../components/PortfolioPlot';
import PositionsTable from '../components/PositionsTable';
import PositionsPie from '../components/PositionsPie';

const Dashboard = ({
  performance,
  updatePerformance,
  stocks,
  updateStocks,
  portfolioPlotData,
  updatePortfolioPlotData,
  push,
}) => {
  const theme = useTheme();

  updatePerformance();
  updateStocks();

  let oldestTodayData = null;
  let newestTodayData = null;
  if (performance.items !== null) {
    const tp = find(performance.items, p => p.kind === 'Total');

    if (tp !== undefined) {
      const dates = filter(
        map(tp.positions, p =>
          p.end.dataSource !== null ? moment(p.end.dataSource.price.date) : null
        ),
        d => d !== null
      );

      if (dates.length > 0) {
        oldestTodayData = min(dates).format('LLL');
        newestTodayData = max(dates).format('LLL');
      }
    }
  }

  return (
    <Grid container spacing={3}>
      <Hidden xsDown implementation="js">
        <Grid item xs={12} style={{ padding: theme.spacing(1) }}>
          <PortfolioPlot
            data={portfolioPlotData}
            updateData={updatePortfolioPlotData}
            performance={performance}
          />
        </Grid>
      </Hidden>
      <Grid item xs={12} style={{ padding: theme.spacing(1) }}>
        <PerformanceTable performance={performance} />
      </Grid>
      <Grid item xs={12} style={{ padding: theme.spacing(1) }}>
        <PositionsTable stocks={stocks} performance={performance} push={push} />
      </Grid>
      <Hidden xsDown implementation="js">
        <Grid item xs={12} style={{ padding: theme.spacing(1) }}>
          <PositionsPie stocks={stocks} performance={performance} />
        </Grid>
      </Hidden>
      {oldestTodayData !== null && (
        <Grid item xs={12} style={{ padding: theme.spacing(1) }}>
          <Container maxWidth="xl" style={{ padding: '0px' }}>
            <Paper style={{ padding: theme.spacing(1) }}>
              <Typography variant="caption">
                <div style={{ marginTop: '1em', marginLeft: '0.5em' }}>
                  {`Die Performance-Berechnungen wurden ${moment(
                    performance.lastUpdated
                  ).fromNow()} aktualisiert. Alle Echtzeit-Preisberechnungen basieren auf Daten vom`}
                  {oldestTodayData !== newestTodayData
                    ? ` ${oldestTodayData} bis ${newestTodayData}.`
                    : ` ${oldestTodayData}.`}
                </div>
              </Typography>
            </Paper>
          </Container>
        </Grid>
      )}
    </Grid>
  );
};

Dashboard.propTypes = {
  performance: PropTypes.shape({
    items: PropTypes.arrayOf(PropTypes.object),
    lastUpdated: PropTypes.number,
  }).isRequired,
  updatePerformance: PropTypes.func.isRequired,
  stocks: PropTypes.shape({
    items: PropTypes.arrayOf(PropTypes.object),
    lastUpdated: PropTypes.number,
  }).isRequired,
  updateStocks: PropTypes.func.isRequired,
  portfolioPlotData: PropTypes.arrayOf(PropTypes.object).isRequired,
  updatePortfolioPlotData: PropTypes.func.isRequired,
  push: PropTypes.func.isRequired,
};

const mapDispatchToProps = dispatch => ({
  updatePerformance: () => dispatch(updatePerformanceAction()),
  updateStocks: () => dispatch(updateStocksAction()),
  updatePortfolioPlotData: (startDate, endDate, source) =>
    dispatch(updatePortfolioPlotAction(startDate, endDate, source)),
  push: x => dispatch(routerPush(x)),
});

const mapStateToProps = state => {
  const { performance, stocks, portfolioPlot } = state;

  return {
    performance,
    stocks,
    portfolioPlotData: portfolioPlot.items,
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(Dashboard);
