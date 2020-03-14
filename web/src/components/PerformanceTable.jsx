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

import PerformanceRow from './PerformanceRow';

const PerformanceTable = ({ performance }) => {
  const StyledTableCell = withStyles(() => ({
    head: {
      fontWeight: 600,
    },
  }))(TableCell);

  if (performance.items !== null) {
    const tp = find(performance.items, p => p.kind === 'Total');
    let oldestTodayData = null;
    let newestTodayData = null;

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

    return (
      <>
        <Paper>
          <TableContainer>
            <Table size="small" aria-label="performance">
              <TableHead>
                <TableRow>
                  <StyledTableCell rowSpan="2">Zeitraum</StyledTableCell>
                  <StyledTableCell align="center" colSpan="2">
                    Start
                  </StyledTableCell>
                  <StyledTableCell align="center" colSpan="2">
                    Ende
                  </StyledTableCell>
                  <StyledTableCell align="right" rowSpan="2">
                    Gewinn
                  </StyledTableCell>
                  <StyledTableCell align="right" rowSpan="2">
                    Zinsfuß
                  </StyledTableCell>
                </TableRow>
                <TableRow>
                  <StyledTableCell align="right">Investiert</StyledTableCell>
                  <StyledTableCell align="right">Wert</StyledTableCell>
                  <StyledTableCell align="right">Investiert</StyledTableCell>
                  <StyledTableCell align="right">Wert</StyledTableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {performance.items.map(
                  item =>
                    ['Today', 'WeekToDate'].includes(item.kind) && (
                      <PerformanceRow
                        data={item}
                        key={`${item.kind}-${item.end.date}`}
                      />
                    )
                )}
                <TableRow>
                  {Array(7)
                    .fill(1)
                    .map((_, i) => (
                      <TableCell key={`filler0-${i.toString()}`}>
                        &nbsp;
                      </TableCell>
                    ))}
                </TableRow>
                {performance.items.map(
                  item =>
                    ['Total', 'YearToYear', 'YearToDate'].includes(
                      item.kind
                    ) && (
                      <PerformanceRow
                        data={item}
                        key={`${item.kind}-${item.end.date}`}
                      />
                    )
                )}
                <TableRow>
                  {Array(7)
                    .fill(1)
                    .map((_, i) => (
                      <TableCell key={`filler1-${i.toString()}`}>
                        &nbsp;
                      </TableCell>
                    ))}
                </TableRow>
                {performance.items.map(
                  item =>
                    ['MonthToMonth', 'MonthToDate'].includes(item.kind) && (
                      <PerformanceRow
                        data={item}
                        key={`${item.kind}-${item.end.date}`}
                      />
                    )
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

PerformanceTable.propTypes = {
  performance: PropTypes.shape({
    items: PropTypes.arrayOf(PropTypes.object),
    lastUpdated: PropTypes.number,
    isFetching: PropTypes.bool,
  }).isRequired,
};

export default PerformanceTable;
