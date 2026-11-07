import { connect } from 'react-redux';
import type { ConnectedProps } from 'react-redux';
import { Grid, Typography, Container, Paper, useTheme } from '@mui/material';
import { find, filter, max, min, map } from 'lodash';
import moment from 'moment';
import type { Moment } from 'moment';
import { useNavigate } from 'react-router-dom';

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
import { formatDateTime } from '../format';

import type { DataSourceSelection, IsoDate } from '../types/api';
import type { AppDispatch } from '../types/actions';
import type { RootState } from '../types/store';

type Props = ConnectedProps<typeof connector>;

const Dashboard = ({
  performance,
  updatePerformance,
  stocks,
  updateStocks,
  portfolioPlotData,
  updatePortfolioPlotData,
}: Props) => {
  const navigate = useNavigate();
  const theme = useTheme();

  updatePerformance();
  updateStocks();

  let oldestTodayData: string | null = null;
  let newestTodayData: string | null = null;
  let hasStuff = true;

  if (performance.data !== null) {
    const tp = find(performance.data, p => p.kind === 'Total');

    if (tp !== undefined) {
      const dates = filter(
        map(tp.positions, p =>
          p.end.dataSource !== null ? moment(p.end.dataSource.price.date) : null
        ),
        (d): d is Moment => d !== null
      );

      hasStuff = Object.keys(tp.positions).length > 0;

      // lodash min/max return undefined exactly when `dates` is empty, so this
      // is the same guard as the `dates.length > 0` it replaces, but narrowing.
      const oldest = min(dates);
      const newest = max(dates);
      if (oldest !== undefined && newest !== undefined) {
        oldestTodayData = formatDateTime(oldest);
        newestTodayData = formatDateTime(newest);
      }
    }
  }

  return (
    <Grid container spacing={3}>
      {hasStuff && (
        <Hidden xsDown>
          <Grid size={12} style={{ padding: theme.spacing(1) }}>
            <PortfolioPlot
              data={portfolioPlotData}
              updateData={updatePortfolioPlotData}
              performance={performance}
            />
          </Grid>
        </Hidden>
      )}
      <Grid size={12} style={{ padding: theme.spacing(1) }}>
        <PerformanceTable performance={performance} />
      </Grid>
      {hasStuff && (
        <>
          <Grid size={12} style={{ padding: theme.spacing(1) }}>
            <PositionsTable
              stocks={stocks}
              performance={performance}
              push={navigate}
            />
          </Grid>
          <Hidden xsDown>
            <Grid size={12} style={{ padding: theme.spacing(1) }}>
              <PositionsPie stocks={stocks} performance={performance} />
            </Grid>
          </Hidden>
          <Hidden xsDown>
            <Grid size={12} style={{ padding: theme.spacing(1) }}>
              <Breakdowns stocks={stocks} performance={performance} />
            </Grid>
          </Hidden>
        </>
      )}
      {oldestTodayData !== null && (
        <Grid size={12} style={{ padding: theme.spacing(1) }}>
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

const mapDispatchToProps = (dispatch: AppDispatch) => ({
  updatePerformance: () => dispatch(updatePerformanceAction()),
  updateStocks: () => dispatch(updateStocksAction()),
  updatePortfolioPlotData: (
    startDate: IsoDate | null,
    endDate: IsoDate | null,
    source: DataSourceSelection | null
  ) => dispatch(updatePortfolioPlotAction(startDate, endDate, source)),
});

const mapStateToProps = (state: RootState) => {
  const { performance, stocks, portfolioPlot } = state;

  return {
    performance,
    stocks,
    portfolioPlotData: portfolioPlot.items,
  };
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export default connector(Dashboard);
