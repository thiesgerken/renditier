import { connect } from 'react-redux';
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

import { initPerformance } from '../actions/performance';

const Dashboard = ({ performance, onInitPerformance }) => {
  onInitPerformance();

  const formatAmount = value => (value === null ? '' : `${value.toFixed(2)}€`);

  const StyledTableCell = withStyles(() => ({
    head: {
      fontWeight: 600,
    },
  }))(TableCell);

  return (
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
            <StyledTableCell />
            <StyledTableCell />
          </TableRow>
        </TableHead>
        <TableBody>
          {performance.map(item => (
            <TableRow key={item.description}>
              <TableCell>{item.description}</TableCell>
              <TableCell align="right">
                {item.start === null
                  ? '\u2014'
                  : formatAmount(-1 * item.start.invested)}
              </TableCell>
              <TableCell align="right">
                {item.start === null
                  ? '\u2014'
                  : formatAmount(item.start.value)}
              </TableCell>
              <TableCell align="right">
                {formatAmount(-1 * item.end.invested)}
              </TableCell>
              <TableCell align="right">
                {formatAmount(item.end.value)}
              </TableCell>
              <TableCell align="right">
                {formatAmount(
                  item.end.value +
                    item.end.invested -
                    (item.start === null
                      ? 0.0
                      : item.start.value + item.start.invested)
                )}
              </TableCell>
              <TableCell align="right">
                {item.irr === null
                  ? '\u2014'
                  : `${(item.irr * 100).toFixed(1)}%`}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

Dashboard.propTypes = {
  performance: PropTypes.arrayOf(PropTypes.object).isRequired,
  onInitPerformance: PropTypes.func.isRequired,
};

const mapDispatchToProps = dispatch => ({
  onInitPerformance: () => dispatch(initPerformance()),
});

const mapStateToProps = ({ performance }) => ({
  performance: performance.items,
});

export default connect(mapStateToProps, mapDispatchToProps)(Dashboard);
