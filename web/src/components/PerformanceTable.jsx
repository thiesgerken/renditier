import React from 'react';
import PropTypes from 'prop-types';

import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import Paper from '@material-ui/core/Paper';
import { withStyles } from '@material-ui/core/styles';
import * as moment from 'moment';
import { find, map, min, max } from 'lodash';

import PerformanceRow from './PerformanceRow';

const PerformanceTable = ({ performance }) => {
  const StyledTableCell = withStyles(() => ({
    head: {
      fontWeight: 600,
    },
  }))(TableCell);

  const tp = find(performance.items, p => p.kind === 'Total');
  let oldestTodayData = null;
  let newestTodayData = null;
  if (tp !== undefined) {
    const dates = map(tp.positions, p => moment(p.end.dataSource.price.date));

    if (dates.length > 0) {
      oldestTodayData = min(dates).format('LLL');
      newestTodayData = max(dates).format('LLL');
    }
  }

  return (
    <>
      <TableContainer component={Paper}>
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
                  <TableCell key={`filler0-${i.toString()}`}>&nbsp;</TableCell>
                ))}
            </TableRow>
            {performance.items.map(
              item =>
                ['Total', 'YearToYear', 'YearToDate'].includes(item.kind) && (
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
                  <TableCell key={`filler1-${i.toString()}`}>&nbsp;</TableCell>
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
      {performance.lastUpdated !== null && (
        <div>
          {`Berechnungen aktualisiert: ${moment(performance.lastUpdated).format(
            'LLL'
          )} (${moment(performance.lastUpdated).fromNow()})`}
        </div>
      )}
      {oldestTodayData && (
        <div>
          Echtzeit-Preisberechnungen basierend auf Daten von
          {oldestTodayData !== newestTodayData
            ? ` ${oldestTodayData} bis ${newestTodayData}`
            : ` ${oldestTodayData}`}
        </div>
      )}
    </>
  );
};

PerformanceTable.propTypes = {
  performance: PropTypes.shape({
    items: PropTypes.arrayOf(PropTypes.object),
    lastUpdated: PropTypes.number,
  }).isRequired,
};

export default PerformanceTable;
