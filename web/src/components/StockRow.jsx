import React from 'react';
import PropTypes from 'prop-types';

import TableCell from '@material-ui/core/TableCell';
import TableRow from '@material-ui/core/TableRow';
import {
  Button,
  withStyles,
  Link,
  IconButton,
  Hidden,
} from '@material-ui/core';
import ShowChartIcon from '@material-ui/icons/ShowChart';

// rgb(160, 20, 139)

const StyledButton = withStyles(() => ({
  root: { textTransform: 'none', fontWeight: 600 },
}))(Button);

const StockRow = ({ data }) => {
  return (
    <TableRow>
      <TableCell style={{ padding: '2px' }}>
        <Button variant="text" color="primary" startIcon={<ShowChartIcon />}>
          {data.isin}
        </Button>
      </TableCell>
      <TableCell>{data.title}</TableCell>
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
        <TableCell>
          <StyledButton
            color="secondary"
            rel="noreferrer"
            size="small"
            href={`https://www.onvista.de${data.onvistaUrl}`}
            target="_blank"
          >
            onvista
          </StyledButton>
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
};

export default StockRow;
