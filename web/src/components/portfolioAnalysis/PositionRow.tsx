import TableCell from '@mui/material/TableCell';
import TableRow from '@mui/material/TableRow';
import { useTheme, useMediaQuery, Button } from '@mui/material';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import type { PositionPerformance, Stock } from '../../types/api';
import { abbreviateTitle } from '../../selectors/stocks';
import OnvistaButton from '../OnvistaButton';
import Hidden from '../Hidden';
import useTableFormat from '../useTableFormat';
import {
  InvestedCell,
  PriceCell,
  ProfitCell,
  UnitsCell,
  ValueCell,
} from '../PerformanceCells';

// PositionsTable spreads the ISIN (the key of PortfolioPerformance.positions)
// onto each entry before handing it over.
type PositionRowData = PositionPerformance & { isin: string };

interface Props {
  data: PositionRowData;
  stock?: Stock | null;
  push: (path: string) => void;
}

const PositionRow = ({ data, stock = null, push }: Props) => {
  const theme = useTheme();
  const xsDown = useMediaQuery(theme.breakpoints.down('sm'));

  const { irr, ratioColor } = useTableFormat();

  return (
    <TableRow>
      <Hidden lgDown>
        <TableCell>{data.isin}</TableCell>
      </Hidden>
      <TableCell
        style={{
          padding: '2px',
        }}
      >
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
              WebkitLineClamp: xsDown ? 3 : 2,
              textAlign: 'left',
            }}
          >
            {stock !== null ? abbreviateTitle(stock.title, xsDown) : data.isin}
          </span>
        </Button>
      </TableCell>
      <Hidden xsDown>
        <UnitsCell period={data} />
        <PriceCell period={data} />
        <InvestedCell period={data} />
      </Hidden>
      <ValueCell period={data} />
      <ProfitCell period={data} />
      <TableCell
        align="right"
        style={{ whiteSpace: 'nowrap', ...ratioColor(data.irrAnnual) }}
      >
        {irr(data)}
      </TableCell>
      <Hidden lgDown>
        <TableCell align="center">
          {stock && <OnvistaButton relativeUrl={stock.onvistaUrl} />}
        </TableCell>
      </Hidden>
    </TableRow>
  );
};

export default PositionRow;
