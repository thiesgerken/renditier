import React from 'react';
import PropTypes from 'prop-types';

import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import Paper from '@material-ui/core/Paper';
import { Typography, Grid, CircularProgress } from '@material-ui/core';
import { withStyles } from '@material-ui/core/styles';
import * as moment from 'moment';
import { filter, find, map, min, max } from 'lodash';

import PositionRow from './PositionRow';

// TODO: Footer with totals
// TODO: combobox to select timespan; show vorher/nachher columns only if needed (start !== null)

const PositionsTable = ({ performance }) => {
  const StyledTableCell = withStyles(() => ({
    head: {
      fontWeight: 600,
    },
  }))(TableCell);

  const tp =
    performance.items === null
      ? undefined
      : find(performance.items, p => p.kind === 'Total');
  if (tp !== undefined) {
    let oldestTodayData = null;
    let newestTodayData = null;

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

    const positions = map(tp.positions, (item, isin) => ({ ...item, isin }));
    positions.sort((a, b) => a.end.invested - b.end.invested);

    return (
      <>
        <Paper>
          <TableContainer>
            <Table size="small" aria-label="positions">
              <TableHead>
                <TableRow>
                  <StyledTableCell>ISIN</StyledTableCell>
                  <StyledTableCell align="right">Einheiten</StyledTableCell>
                  <StyledTableCell align="right">Kurs</StyledTableCell>
                  <StyledTableCell align="right">Investiert</StyledTableCell>
                  <StyledTableCell align="right">Wert</StyledTableCell>
                  <StyledTableCell align="right">Gewinn</StyledTableCell>
                  <StyledTableCell align="right">Zinsfuß</StyledTableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {map(
                  positions,
                  d => d.units !== 0 && <PositionRow data={d} key={d.isin} />
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <Typography variant="caption">
            <Grid
              container
              spacing={0}
              style={{ marginTop: '1em', marginLeft: '0.5em' }}
            >
              {performance.lastUpdated !== null && (
                <Grid item xs={12}>
                  {`Berechnungen aktualisiert: ${moment(
                    performance.lastUpdated
                  ).format('LLL')} (${moment(
                    performance.lastUpdated
                  ).fromNow()})`}
                </Grid>
              )}
              {oldestTodayData && (
                <Grid item xs={12}>
                  Echtzeit-Preisberechnungen basierend auf Daten von
                  {oldestTodayData !== newestTodayData
                    ? ` ${oldestTodayData} bis ${newestTodayData}`
                    : ` ${oldestTodayData}`}
                </Grid>
              )}
            </Grid>
          </Typography>
        </Paper>
      </>
    );
  }

  if (performance.isFetching) {
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

PositionsTable.propTypes = {
  performance: PropTypes.shape({
    items: PropTypes.arrayOf(PropTypes.object),
    lastUpdated: PropTypes.number,
    isFetching: PropTypes.bool,
  }).isRequired,
};

export default PositionsTable;
