import { connect } from 'react-redux';
import React from 'react';
import PropTypes from 'prop-types';
import { Grid, Typography, Container, Paper, useTheme } from '@mui/material';
import { find, filter, max, min, map } from 'lodash';
import moment from 'moment';
import { useHistory } from 'react-router-dom';

import {
  updateStocks as updateStocksAction,
  updatePerformance as updatePerformanceAction,
} from '../actions/api';
import { updatePortfolioPlot as updatePortfolioPlotAction } from '../actions/portfolioPlot';
import PerformanceTable from '../components/portfolioAnalysis/PerformanceTable';
import PortfolioPlot from '../components/portfolioAnalysis/PortfolioPlot';
import PositionsTable from '../components/portfolioAnalysis/PositionsTable';
import PositionsPie from '../components/portfolioAnalysis/PositionsPie';
import Hidden from '../components/Hidden';
import Breakdowns from '../components/portfolioAnalysis/Breakdowns';

const Dashboard = ({
  performance,
  updatePerformance,
  stocks,
  updateStocks,
  portfolioPlotData,
  updatePortfolioPlotData,
}) => {
  const history = useHistory();
  const theme = useTheme();

  updatePerformance();
  updateStocks();

  let oldestTodayData = null;
  let newestTodayData = null;
  let hasStuff = true;

  if (performance.data !== null) {
    const tp = find(performance.data, p => p.kind === 'Total');

    if (tp !== undefined) {
      const dates = filter(
        map(tp.positions, p =>
          p.end.dataSource !== null ? moment(p.end.dataSource.price.date) : null
        ),
        d => d !== null
      );

      hasStuff = Object.keys(tp.positions).length > 0;

      if (dates.length > 0) {
        oldestTodayData = min(dates).format('LLL');
        newestTodayData = max(dates).format('LLL');
      }
    }
  }

  return (
    <Grid container spacing={3}>
      {hasStuff && (
        <Hidden xsDown implementation="js">
          <Grid item xs={12} style={{ padding: theme.spacing(1) }}>
            <PortfolioPlot
              data={portfolioPlotData}
              updateData={updatePortfolioPlotData}
              performance={performance}
            />
          </Grid>
        </Hidden>
      )}
      <Grid item xs={12} style={{ padding: theme.spacing(1) }}>
        <PerformanceTable performance={performance} />
      </Grid>
      {hasStuff && (
        <>
          <Grid item xs={12} style={{ padding: theme.spacing(1) }}>
            <PositionsTable
              stocks={stocks}
              performance={performance}
              push={history.push}
            />
          </Grid>
          <Hidden xsDown implementation="js">
            <Grid item xs={12} style={{ padding: theme.spacing(1) }}>
              <PositionsPie stocks={stocks} performance={performance} />
            </Grid>
          </Hidden>
          <Hidden xsDown implementation="js">
            <Grid item xs={12} style={{ padding: theme.spacing(1) }}>
              <Breakdowns stocks={stocks} performance={performance} />
            </Grid>
          </Hidden>
        </>
      )}
      {oldestTodayData !== null && (
        <Grid item xs={12} style={{ padding: theme.spacing(1) }}>
          <Container maxWidth="xl" style={{ padding: '0px' }}>
            <Paper style={{ padding: theme.spacing(1) }}>
              <Typography variant="caption">
                <div style={{ marginTop: '1em', marginLeft: '0.5em' }}>
                  {`Die Performance-Berechnungen wurden ${moment(
                    performance.lastRequest
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
    data: PropTypes.arrayOf(PropTypes.shape({})),
    lastRequest: PropTypes.number,
  }).isRequired,
  updatePerformance: PropTypes.func.isRequired,
  stocks: PropTypes.shape({
    data: PropTypes.arrayOf(PropTypes.shape({})),
  }).isRequired,
  updateStocks: PropTypes.func.isRequired,
  portfolioPlotData: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  updatePortfolioPlotData: PropTypes.func.isRequired,
};

const mapDispatchToProps = dispatch => ({
  updatePerformance: () => dispatch(updatePerformanceAction()),
  updateStocks: () => dispatch(updateStocksAction()),
  updatePortfolioPlotData: (startDate, endDate, source) =>
    dispatch(updatePortfolioPlotAction(startDate, endDate, source)),
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
