import React, { useState } from 'react';
import PropTypes from 'prop-types';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import {
  Container,
  Hidden,
  Grid,
  MenuItem,
  InputLabel,
  Select,
  FormControl,
} from '@material-ui/core';
import { withStyles, makeStyles } from '@material-ui/core/styles';
import { map } from 'lodash';

import PositionRow from './PositionRow';
import { getPeriodDescription } from '../../selectors/performance';
import { findStock } from '../../selectors/stocks';
import ProgressPaper from '../ProgressPaper';

const useStyles = makeStyles(theme => ({
  formControl: {
    margin: theme.spacing(1),
    minWidth: 120,
  },
  selectEmpty: {
    marginTop: theme.spacing(2),
  },
}));

const StyledTableCell = withStyles(() => ({
  head: {
    fontWeight: 600,
  },
}))(TableCell);

const PositionsTable = ({ performance, stocks, push }) => {
  const classes = useStyles();
  const [period, setPeriod] = useState(0);

  const handlePeriodChange = event => {
    setPeriod(event.target.value);
  };

  const tp =
    performance.data === null || period >= performance.data.length
      ? undefined
      : performance.data[period];

  const positions =
    tp === undefined
      ? []
      : map(tp.positions, (item, isin) => ({ ...item, isin }));
  positions.sort((a, b) => a.end.invested - b.end.invested);

  return (
    <Container maxWidth="xl" style={{ padding: '0px' }}>
      <ProgressPaper loading={performance.isFetching}>
        <Grid container style={{ width: '100%' }}>
          <Grid item xs={12}>
            <TableContainer>
              <Table size="small" aria-label="positions">
                <TableHead>
                  <TableRow>
                    <Hidden lgDown>
                      <StyledTableCell>ISIN</StyledTableCell>
                    </Hidden>
                    <StyledTableCell>Name</StyledTableCell>
                    <Hidden lgDown>
                      <StyledTableCell align="right">Einheiten</StyledTableCell>
                    </Hidden>
                    <Hidden xsDown>
                      <StyledTableCell align="right">Kurs</StyledTableCell>
                      <StyledTableCell align="right">
                        Investiert
                      </StyledTableCell>
                    </Hidden>
                    <StyledTableCell align="right">Wert</StyledTableCell>
                    <StyledTableCell align="right">Gewinn</StyledTableCell>
                    <StyledTableCell align="right">Zinsfuß</StyledTableCell>
                    <Hidden lgDown>
                      <StyledTableCell align="right">&nbsp;</StyledTableCell>
                    </Hidden>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {map(
                    positions,
                    d =>
                      d.units !== 0 && (
                        <PositionRow
                          data={d}
                          key={d.isin}
                          push={push}
                          stock={findStock(stocks, d.isin)}
                        />
                      )
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Grid>
          <Grid item xs={9}>
            <FormControl className={classes.formControl}>
              <InputLabel id="period-select-label">Zeit</InputLabel>
              <Select
                labelId="period-select-label"
                id="period-select"
                autoWidth
                value={
                  performance.data === null || performance.data.length === 0
                    ? ''
                    : period
                }
                onChange={handlePeriodChange}
              >
                {performance.data !== null &&
                  performance.data.map((item, i) => (
                    <MenuItem value={i} key={i}>
                      {getPeriodDescription(item)}
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </ProgressPaper>
    </Container>
  );
};

PositionsTable.propTypes = {
  performance: PropTypes.shape({
    data: PropTypes.arrayOf(PropTypes.object),
    isFetching: PropTypes.bool,
  }).isRequired,
  stocks: PropTypes.shape({
    data: PropTypes.arrayOf(PropTypes.object),
    isFetching: PropTypes.bool,
  }).isRequired,
  push: PropTypes.func.isRequired,
};

export default PositionsTable;
