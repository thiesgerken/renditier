import React from 'react';
import PropTypes from 'prop-types';
import TableCell from '@material-ui/core/TableCell';
import TableRow from '@material-ui/core/TableRow';
import { Button, Hidden, useTheme, useMediaQuery } from '@material-ui/core';
import ShowChartIcon from '@material-ui/icons/ShowChart';

import { abbreviateTitle } from '../selectors/stocks';
import OnvistaButton from './OnvistaButton';

const StockRow = ({ data, push }) => {
  const theme = useTheme();
  const xsDown = useMediaQuery(theme.breakpoints.down('xs'));

  return (
    <TableRow>
      <TableCell>{data.isin}</TableCell>
      <TableCell style={{ padding: '2px' }}>
        <Button
          variant="text"
          color="primary"
          startIcon={<ShowChartIcon />}
          onClick={() => push(`/stocks/${data.isin}`)}
        >
          <span
            style={{
              wordWrap: 'break-word',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              // wordBreak: 'break-all',
              WebkitLineClamp: 2,
              textAlign: 'left',
            }}
          >
            {abbreviateTitle(data.title, xsDown)}
          </span>
        </Button>
      </TableCell>
      <TableCell>{data.kind}</TableCell>
      <Hidden xsDown>
        <TableCell>{data.focus}</TableCell>
      </Hidden>
      <Hidden lgDown>
        <TableCell>{data.fondsType}</TableCell>
      </Hidden>
      <Hidden lgDown>
        <TableCell>{data.company}</TableCell>
      </Hidden>
      <Hidden xsDown>
        <TableCell
          style={{
            padding: '2px',
          }}
        >
          <OnvistaButton relativeUrl={data.onvistaUrl} />
        </TableCell>
      </Hidden>
    </TableRow>
  );
};

StockRow.propTypes = {
  data: PropTypes.shape({
    isin: PropTypes.string,
    title: PropTypes.string,
    kind: PropTypes.string,
    wkn: PropTypes.string,
    focus: PropTypes.string,
    fondsType: PropTypes.string,
    company: PropTypes.string,
    onvistaUrl: PropTypes.string,
  }).isRequired,
  push: PropTypes.func.isRequired,
};

export default StockRow;
