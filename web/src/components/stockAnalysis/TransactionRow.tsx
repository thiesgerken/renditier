import TableCell from '@mui/material/TableCell';
import TableRow from '@mui/material/TableRow';
import { Tooltip } from '@mui/material';

import Hidden from '../Hidden';
import useTableFormat from '../useTableFormat';
import { getPrice } from '../../selectors/performance';
import { formatDate, formatDateTime } from '../../format';
import type { DataSource, EitherPrice, Transaction } from '../../types/api';

interface Props {
  transaction: Transaction;
  currentPrice?: DataSource<EitherPrice> | null;
}

const TransactionRow = ({ transaction, currentPrice = null }: Props) => {
  const { money, units, percent, signColor } = useTableFormat();

  let currentValueInfo = '\u2014';
  let valueDevelopment: number | undefined;
  if (currentPrice !== null && transaction.units !== 0) {
    // `?? 0` reproduces the original multiplication, in which a null price was
    // coerced to 0.
    const currentValue =
      Math.abs(transaction.units) * (getPrice(currentPrice) ?? 0);

    valueDevelopment =
      (transaction.fees + transaction.amount) / 100 + currentValue;
    currentValueInfo = `${money(currentValue)} (${percent(
      ((-1 * valueDevelopment) / (transaction.fees + transaction.amount)) * 100,
      { signed: true }
    )})`;
  }

  return (
    <TableRow>
      <TableCell align="left">
        <Tooltip title={formatDateTime(transaction.date)} arrow>
          <span>{formatDate(transaction.date)}</span>
        </Tooltip>
      </TableCell>
      <TableCell align="right" style={signColor(transaction.units)}>
        {transaction.units === 0
          ? '\u2014'
          : units(transaction.units, { signed: true })}
      </TableCell>
      <Hidden lgDown>
        <TableCell align="right">
          {transaction.units !== 0
            ? money((-1 * transaction.amount) / 100 / transaction.units)
            : '\u2014'}
        </TableCell>
      </Hidden>
      <TableCell
        align="right"
        style={signColor((transaction.amount + transaction.fees) / 100)}
      >
        <Tooltip
          title={
            transaction.fees !== 0
              ? `enthält Gebühren in Höhe von ${money(
                  (-1 * transaction.fees) / 100
                )}`
              : ''
          }
          arrow
        >
          <span>{money((transaction.amount + transaction.fees) / 100)}</span>
        </Tooltip>
      </TableCell>
      <TableCell align="right" style={signColor(valueDevelopment)}>
        {currentValueInfo}
      </TableCell>
    </TableRow>
  );
};

export default TransactionRow;
