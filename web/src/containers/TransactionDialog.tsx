import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Grid,
  TextField,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import type { InputBaseComponentProps } from '@mui/material/InputBase';
import { DateTimePicker } from '@mui/x-date-pickers';
import { find, reverse, sortBy, sortedUniqBy } from 'lodash';
import moment from 'moment';
import type { Moment } from 'moment';
import type { ElementType } from 'react';
import React, { useState } from 'react';
import { connect } from 'react-redux';
import type { ConnectedProps } from 'react-redux';
import DeleteIcon from '@mui/icons-material/Delete';

import {
  deleteTransaction as deleteTransactionAction,
  createTransaction as createTransactionAction,
  updateTransaction as updateTransactionAction,
} from '../actions/transactions';
import NumberInput from '../components/NumberInput';
import { findAccount, findAccountByName } from '../selectors/accounts';
import { abbreviateTitle, findStock } from '../selectors/stocks';
import type { AppDispatch } from '../types/actions';
import type { Exchange, Transaction } from '../types/api';
import type { RootState } from '../types/store';

// What `Transactions` hands in: a real transaction when editing, or a blank one
// with no id / account / isin yet when creating.
export type TransactionDraft = Omit<
  Transaction,
  'id' | 'accountId' | 'isin'
> & {
  id: number | null;
  accountId: number | null;
  isin: string | null;
};

// The submitted payload — identical to a Transaction except that `id` is still
// null when the transaction is being created.
type TransactionPayload = Omit<Transaction, 'id'> & { id: number | null };

// MUI types `inputComponent` as ElementType<InputBaseComponentProps>, i.e. raw
// DOM input props, but NumberInput deliberately takes a synthesized `onChange`
// and a callback `inputRef`; the cast records that mismatch in one place.
const NumberInputComponent =
  NumberInput as ElementType<InputBaseComponentProps>;

// The dialog's form state. The numeric fields hold whatever the text inputs
// produce, so they are strings once the user has typed into them.
interface EditableTransaction {
  id: number | null;
  isin: string | null;
  exchange: string;
  comments: string;
  units: number | string;
  amount: number | string;
  fees: number | string;
  account: string | null;
  date: Moment;
  receiptNumber: number | null;
}

const TransactionDialog = ({
  stocks,
  accounts,
  initialTransaction,
  open,
  onClose,
  deleteTransaction,
  createTransaction,
  updateTransaction,
}: Props) => {
  const parseISIN = (s: string | null): string | null => {
    if (!s) return null;

    const m = s.toUpperCase().match(/^[A-Z]{2}[0-9A-Z]{10}/);
    if (m !== null && m.length === 1) return m[0];
    return null;
  };

  // FIXME(tsx-migration): dropped the `if (s === '') return '';` sentinel — the
  // only caller guards on `exchange.trim() !== ''`, and an empty string return
  // would have crashed the `ex.onvistaExchangeId` read below.
  const findExchangeByName = (
    stock: { exchanges: Exchange[] } | null,
    s: string | null
  ): Exchange | null => {
    if (!s || !stock) return null;

    const m = find(
      stock.exchanges,
      e => e.name.toUpperCase().trim() === s.toUpperCase().trim()
    );

    return m || null;
  };

  // FIXME(tsx-migration): dropped the `ex === ''` sentinel check here for the
  // same reason — `find` yields an Exchange or undefined, never ''.
  const getExchangeName = (ex: Exchange | undefined): string => {
    if (!ex) return '';
    return ex.name || '';
  };

  const isValidFloat = (s: string | number | null): boolean => {
    if (s === null || s === '') return false;

    const x = parseFloat(String(s));
    if (Number.isNaN(x) || !Number.isFinite(x)) return false;
    return true;
  };

  const toTransaction = (t: EditableTransaction): TransactionPayload | null => {
    if (
      t.isin === null ||
      !t.date.isValid() ||
      !isValidFloat(t.amount) ||
      !isValidFloat(t.fees) ||
      !isValidFloat(t.units)
    )
      return null;

    const tAccount = findAccountByName(accounts, t.account);
    if (tAccount === null) return null;

    if (
      parseFloat(String(t.units)) === 0 &&
      Math.abs(parseFloat(String(t.amount))) +
        Math.abs(parseFloat(String(t.fees))) <
        0.01
    )
      return null;

    const ret: TransactionPayload = {
      id: t.id,
      isin: t.isin,
      onvistaExchangeId: null,
      exchange: null,
      comments: t.comments,
      units: parseFloat(String(t.units)),
      amount: -1 * Math.round(parseFloat(String(t.amount)) * 100),
      fees: -1 * Math.round(parseFloat(String(t.fees)) * 100),
      accountId: tAccount.id,
      date: t.date.format(),
      // FIXME(tsx-migration): `receiptNumber` was omitted from the payload
      // entirely, so serde defaulted it to None and every PUT wiped the link
      // between an edited transaction and the receipt it was imported from.
      receiptNumber: t.receiptNumber,
    };

    const tStock = findStock(stocks, t.isin) || { exchanges: [] };
    if (t.exchange.trim() !== '') {
      const ex = findExchangeByName(tStock, t.exchange);

      if (ex === null || ex.onvistaExchangeId === null) {
        ret.exchange = t.exchange.trim();
      } else {
        ret.onvistaExchangeId = ex.onvistaExchangeId;
      }
    }

    return ret;
  };

  const toEditable = (t: TransactionDraft): EditableTransaction => {
    const initialStock = t.isin !== null ? findStock(stocks, t.isin) : null;
    const initialAccount = findAccount(accounts, t.accountId);

    let ex: string;
    if (t.id !== null && t.onvistaExchangeId !== null)
      ex = initialStock
        ? getExchangeName(
            find(
              initialStock.exchanges,
              e => e.onvistaExchangeId === t.onvistaExchangeId
            )
          )
        : // FIXME(tsx-migration): this fell back to the raw numeric id, which
          // then blew up on `exchange.trim()` in toTransaction.
          `${t.onvistaExchangeId}`;
    else if (t.exchange !== null) ex = t.exchange;
    else ex = '';

    return {
      id: t.id,
      isin: t.isin,
      exchange: ex,
      comments: t.comments,
      units: t.units,
      amount: (-1 * t.amount) / 100,
      fees: (-1 * t.fees) / 100,
      account: initialAccount !== null ? initialAccount.name : null,
      date: t.date !== null ? moment(t.date) : moment(''),
      receiptNumber: t.receiptNumber,
    };
  };

  const [transaction, setTransaction] = useState(
    toEditable(initialTransaction)
  );
  const parsedISIN = parseISIN(transaction.isin);
  const stock = parsedISIN !== null ? findStock(stocks, parsedISIN) : null;

  let price = '\u2014';
  if (
    isValidFloat(transaction.units) &&
    isValidFloat(transaction.amount) &&
    parseFloat(String(transaction.units)) !== 0.0
  )
    price = `${(
      parseFloat(String(transaction.amount)) /
      parseFloat(String(transaction.units))
    ).toFixed(4)}€`;

  // console.log(initialTransaction);
  // console.log(transaction);

  const theme = useTheme();
  const mdUp = useMediaQuery(theme.breakpoints.up('md'));

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [triedToSave, setTriedToSave] = useState(false);

  const reset = () => {
    setTransaction(toEditable(initialTransaction));
    setTriedToSave(false);
  };

  const wasOpen = React.useRef(false);
  React.useEffect(() => {
    if (open && !wasOpen.current) reset();
    wasOpen.current = open;
  });

  const handleDialogClose = (_event: object, reason: string) => {
    if (reason === 'backdropClick') return;

    reset();
    onClose();
  };

  const onDelete = () => {
    setConfirmOpen(false);
    // The delete button only renders when `transaction.id !== null`.
    if (transaction.id !== null) deleteTransaction(transaction.id);
    onClose();
  };

  const onSave = () => {
    const t = toTransaction(transaction);

    if (t === null) {
      setTriedToSave(true);
      return;
    }

    if (t.id === null) {
      createTransaction(t);
    } else {
      updateTransaction({ ...t, id: t.id });
    }

    onClose();
  };

  const badCombination =
    isValidFloat(transaction.amount) &&
    isValidFloat(transaction.fees) &&
    isValidFloat(transaction.units) &&
    parseFloat(String(transaction.units)) === 0 &&
    Math.abs(parseFloat(String(transaction.amount))) +
      Math.abs(parseFloat(String(transaction.fees))) <
      0.01;

  return (
    <>
      <Dialog fullScreen={!mdUp} open={open} onClose={handleDialogClose}>
        <DialogTitle id="form-dialog-title">
          {transaction.id !== null
            ? 'Transaktion bearbeiten'
            : 'Transaktion erstellen'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={1}>
            <Grid size={12}>
              <Autocomplete
                freeSolo
                options={stocks.data !== null ? stocks.data : []}
                getOptionLabel={option => {
                  if (typeof option === 'string') return option;
                  return option.isin;
                }}
                // FIXME(tsx-migration): this was written as `option => ...`,
                // but MUI passes (props, option, state) — the callback was
                // reading the props object as if it were the option and
                // returned a bare string instead of an <li>.
                renderOption={(props, option) => {
                  const { key, ...optionProps } = props;
                  return (
                    // eslint-disable-next-line react/jsx-props-no-spreading
                    <li key={key} {...optionProps}>
                      {`${option.isin} (${abbreviateTitle(option.title, true)})`}
                    </li>
                  );
                }}
                onInputChange={(_e, v) =>
                  setTransaction({
                    ...transaction,
                    isin: v,
                  })
                }
                value={transaction.isin || ''}
                autoComplete
                openOnFocus
                renderInput={params => (
                  <TextField
                    // eslint-disable-next-line react/jsx-props-no-spreading
                    {...params}
                    label="ISIN"
                    variant="standard"
                    fullWidth
                    error={triedToSave && parseISIN(transaction.isin) === null}
                  />
                )}
              />
            </Grid>
            <Grid size={12}>
              <Autocomplete
                freeSolo
                options={
                  stock
                    ? reverse(
                        sortedUniqBy(
                          sortBy(stock.exchanges, 'name'),
                          x => x.name
                        )
                      )
                    : []
                }
                getOptionLabel={option => {
                  if (typeof option === 'string') return option;
                  return option.name;
                }}
                autoComplete
                openOnFocus
                onInputChange={(_e, v) =>
                  setTransaction({
                    ...transaction,
                    exchange: v,
                  })
                }
                value={transaction.exchange || ''}
                renderInput={params => (
                  <TextField
                    // eslint-disable-next-line react/jsx-props-no-spreading
                    {...params}
                    label="Handelsplatz"
                    variant="standard"
                    fullWidth
                    // error={
                    //   findExchangeByName(stock, transaction.exchange) === null
                    // }
                  />
                )}
              />
            </Grid>
            {(accounts.items.length > 1 ||
              findAccountByName(accounts, transaction.account) === null) && (
              <Grid size={12}>
                <Autocomplete
                  freeSolo
                  options={accounts.items}
                  getOptionLabel={option => {
                    if (typeof option === 'string') return option;
                    return option.name;
                  }}
                  autoComplete
                  openOnFocus
                  onInputChange={(_e, v) =>
                    setTransaction({
                      ...transaction,
                      account: v,
                    })
                  }
                  value={transaction.account || ''}
                  renderInput={params => (
                    <TextField
                      // eslint-disable-next-line react/jsx-props-no-spreading
                      {...params}
                      label="Depot"
                      variant="standard"
                      fullWidth
                      error={
                        triedToSave &&
                        findAccountByName(accounts, transaction.account) ===
                          null
                      }
                      margin="normal"
                    />
                  )}
                />
              </Grid>
            )}
            <Grid size={12}>
              <DateTimePicker
                label="Datum"
                format="DD/MM/YYYY HH:mm"
                value={transaction.date}
                onChange={(d: Moment | null) => {
                  setTransaction({
                    ...transaction,
                    date: d !== null ? d : moment(''),
                  });
                }}
                disableFuture
                slotProps={{
                  textField: {
                    variant: 'standard',
                    fullWidth: true,
                  },
                }}
              />
            </Grid>
            <Grid size={6}>
              <TextField
                margin="dense"
                label="Kosten"
                variant="standard"
                fullWidth
                value={transaction.amount}
                onChange={(v: React.ChangeEvent<HTMLInputElement>) => {
                  setTransaction({
                    ...transaction,
                    amount: v.target.value,
                  });
                }}
                slotProps={{
                  inputLabel: {
                    shrink: true,
                  },
                  input: {
                    inputComponent: NumberInputComponent,
                    inputProps: {
                      suffix: '€',
                      decimalScale: 2,
                      fixedDecimalScale: true,
                    },
                  },
                }}
                error={
                  triedToSave &&
                  (!isValidFloat(transaction.amount) || badCombination)
                }
              />
            </Grid>
            <Grid size={6}>
              <TextField
                margin="dense"
                label="Gebühren (zzgl.)"
                variant="standard"
                fullWidth
                value={transaction.fees}
                onChange={(v: React.ChangeEvent<HTMLInputElement>) => {
                  setTransaction({
                    ...transaction,
                    fees: v.target.value,
                  });
                }}
                slotProps={{
                  inputLabel: {
                    shrink: true,
                  },
                  input: {
                    inputComponent: NumberInputComponent,
                    inputProps: {
                      allowNegative: false,
                      suffix: '€',
                      decimalScale: 2,
                      fixedDecimalScale: true,
                    },
                  },
                }}
                error={
                  triedToSave &&
                  (!isValidFloat(transaction.fees) || badCombination)
                }
              />
            </Grid>
            <Grid size={6}>
              <TextField
                margin="dense"
                label="Einheiten"
                variant="standard"
                fullWidth
                value={transaction.units}
                onChange={(v: React.ChangeEvent<HTMLInputElement>) => {
                  setTransaction({
                    ...transaction,
                    units: v.target.value,
                  });
                }}
                slotProps={{
                  inputLabel: {
                    shrink: true,
                  },
                  input: {
                    inputComponent: NumberInputComponent,
                    inputProps: {},
                  },
                }}
                error={
                  triedToSave &&
                  (!isValidFloat(transaction.units) || badCombination)
                }
              />
            </Grid>
            <Grid size={6}>
              <TextField
                margin="dense"
                label="Kurs"
                variant="standard"
                disabled
                fullWidth
                value={price}
              />
            </Grid>
            <Grid size={12}>
              <TextField
                margin="dense"
                label="Kommentare"
                variant="standard"
                fullWidth
                multiline
                rows={3}
                value={transaction.comments}
                onChange={(v: React.ChangeEvent<HTMLInputElement>) =>
                  setTransaction({
                    ...transaction,
                    comments: v.target.value,
                  })
                }
              />
            </Grid>
          </Grid>
          {toTransaction(transaction) === null && triedToSave && (
            <Alert severity="error">Transaktion ist unvollständig!</Alert>
          )}
        </DialogContent>
        <DialogActions>
          {transaction.id !== null && (
            <Button
              variant="outlined"
              color="secondary"
              startIcon={<DeleteIcon />}
              onClick={() => setConfirmOpen(true)}
            >
              Löschen
            </Button>
          )}
          <Button color="primary" onClick={onClose}>
            Abbrechen
          </Button>
          <Button color="primary" onClick={onSave}>
            Speichern
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            Transaktion wirklich löschen?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setConfirmOpen(false)}
            color="primary"
            autoFocus
          >
            Nein
          </Button>
          <Button onClick={onDelete} color="primary">
            Ja
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

const mapDispatchToProps = (dispatch: AppDispatch) => ({
  deleteTransaction: (id: number) => dispatch(deleteTransactionAction(id)),
  createTransaction: (t: TransactionPayload) =>
    dispatch(createTransactionAction(t)),
  updateTransaction: (t: Transaction) => dispatch(updateTransactionAction(t)),
});

const mapStateToProps = (state: RootState) => {
  const { stocks, accounts } = state;

  return {
    stocks,
    accounts,
  };
};

const connector = connect(mapStateToProps, mapDispatchToProps);

type Props = ConnectedProps<typeof connector> & {
  initialTransaction: TransactionDraft;
  open: boolean;
  onClose: () => void;
};

export default connector(TransactionDialog);
