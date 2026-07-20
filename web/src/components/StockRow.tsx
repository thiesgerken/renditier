import TableCell from '@mui/material/TableCell';
import TableRow from '@mui/material/TableRow';
import { Button, useTheme, useMediaQuery } from '@mui/material';
import ShowChartIcon from '@mui/icons-material/ShowChart';

import type { Stock } from '../types/api';
import { abbreviateTitle } from '../selectors/stocks';
import OnvistaButton from './OnvistaButton';
import Hidden from './Hidden';

interface Props {
  data: Stock;
  push: (path: string) => void;
}

const StockRow = ({ data, push }: Props) => {
  const theme = useTheme();
  const xsDown = useMediaQuery(theme.breakpoints.down('sm'));

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

export default StockRow;
