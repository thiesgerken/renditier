import React from 'react';
import PropTypes from 'prop-types';

import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import { Container, Hidden, useMediaQuery } from '@material-ui/core';
import { withStyles, useTheme } from '@material-ui/core/styles';

import PerformanceRow from './PerformanceRow';
import ProgressPaper from '../ProgressPaper';

const PerformanceTable = ({ performance }) => {
  const theme = useTheme();
  const xsDown = useMediaQuery(theme.breakpoints.down('xs'));

  const StyledTableCell = withStyles(() => ({
    head: {
      fontWeight: 600,
    },
  }))(TableCell);

  return (
    <Container maxWidth="xl" style={{ padding: '0px' }}>
      <ProgressPaper loading={performance.isFetching}>
        <TableContainer>
          <Table size="small" aria-label="performance">
            <TableHead>
              <TableRow>
                <StyledTableCell>Zeitraum</StyledTableCell>
                <Hidden xsDown>
                  <StyledTableCell align="right">Investiert</StyledTableCell>
                </Hidden>
                <StyledTableCell align="right">Wert</StyledTableCell>
                <StyledTableCell align="right">Gewinn</StyledTableCell>
                <StyledTableCell align="right">Zinsfuß</StyledTableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {performance.data !== null && (
                <>
                  {performance.data.map(
                    item =>
                      ['Today', 'WeekToDate'].includes(item.kind) && (
                        <PerformanceRow
                          data={item}
                          key={`${item.kind}-${item.end.date}`}
                        />
                      )
                  )}
                  <TableRow>
                    {Array(xsDown ? 4 : 5)
                      .fill(1)
                      .map((_, i) => (
                        <TableCell key={`filler0-${i.toString()}`}>
                          &nbsp;
                        </TableCell>
                      ))}
                  </TableRow>
                  {performance.data.map(
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
                    {Array(xsDown ? 4 : 5)
                      .fill(1)
                      .map((_, i) => (
                        <TableCell key={`filler1-${i.toString()}`}>
                          &nbsp;
                        </TableCell>
                      ))}
                  </TableRow>
                  {performance.data.map(
                    item =>
                      ['MonthToMonth', 'MonthToDate'].includes(item.kind) && (
                        <PerformanceRow
                          data={item}
                          key={`${item.kind}-${item.end.date}`}
                        />
                      )
                  )}
                </>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </ProgressPaper>
    </Container>
  );
};

PerformanceTable.propTypes = {
  performance: PropTypes.shape({
    data: PropTypes.arrayOf(PropTypes.object),
    isFetching: PropTypes.bool,
  }).isRequired,
};

export default PerformanceTable;
