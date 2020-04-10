import React, { useState } from 'react';
import PropTypes from 'prop-types';
import {
  useTheme,
  useMediaQuery,
  Dialog,
  Button,
  DialogContent,
  DialogTitle,
  DialogContentText,
  TextField,
  DialogActions,
  Grid,
} from '@material-ui/core';
import Alert from '@material-ui/lab/Alert';
import { find, reverse, sortedUniqBy, sortBy } from 'lodash';
import { DateTimePicker } from '@material-ui/pickers';
import * as moment from 'moment';
import Autocomplete from '@material-ui/lab/Autocomplete';
import { abbreviateTitle, findStock } from '../selectors/stocks';
import { findAccount, findAccountByName } from '../selectors/accounts';
import NumberInput from './NumberInput';

const TransactionDialog = ({
  stocks,
  accounts,
  initialTransaction,
  open,
  onClose,
}) => {
  const parseISIN = s => {
    if (!s) return null;

    const m = s.toUpperCase().match(/^[A-Z]{2}[0-9A-Z]{10}/);
    if (m !== null && m.length === 1) return m[0];
    return null;
  };

  const findExchangeByName = (stock, s) => {
    if (s === '') return '';
    if (!s || !stock) return null;

    const m = find(
      stock.exchanges,
      e => e.name.toUpperCase().trim() === s.toUpperCase().trim()
    );

    return m || null;
  };

  const getExchangeName = ex => {
    if (ex === '') return '';
    return ex.name || null;
  };

  const toTransaction = t => {
    if (
      t.isin === null ||
      t.date === null ||
      !t.date.isValid() ||
      t.amount === null ||
      t.fees === null ||
      t.units === null
    )
      return null;

    const tStock = findStock(stocks, t.isin);
    const tAccount = findAccountByName(accounts, t.account);
    if (tStock === null || tAccount === null) return null;

    if (
      parseFloat(t.units) === 0 &&
      Math.abs(parseFloat(t.amount)) + Math.abs(parseFloat(t.fees)) < 0.01
    )
      return null;

    const ret = {
      id: t.id,
      isin: t.isin,
      onvistaExchangeId: null,
      exchange: null,
      comments: t.comments,
      units: parseFloat(t.units),
      amount: Math.round(parseFloat(t.amount) * 100),
      fees: -1 * Math.round(parseFloat(t.fees) * 100),
      account: tAccount.id,
      date: t.date.format(),
    };

    if (t.exchange.trim() !== '') {
      const ex = findExchangeByName(tStock, t.exchange);

      if (!ex) {
        ret.exchange = t.exchange.trim();
      } else {
        ret.onvistaExchangeId = ex.onvistaExchangeId;
      }
    }

    return ret;
  };

  const toEditable = t => {
    const initialStock = findStock(stocks, t.isin);
    const initialAccount = findAccount(accounts, t.accountId);

    let ex;
    if (t.id !== null && t.onvistaExchangeId !== null)
      ex = initialStock
        ? getExchangeName(
            find(
              initialStock.exchanges,
              e => e.onvistaExchangeId === t.onvistaExchangeId
            )
          )
        : t.onvistaExchangeId;
    else if (t.exchange !== null) ex = t.exchange;
    else ex = '';

    return {
      id: t.id,
      isin: t.isin,
      exchange: ex,
      comments: t.comments,
      units: t.units,
      amount: t.amount / 100,
      fees: (-1 * t.fees) / 100,
      account: initialAccount !== null ? initialAccount.name : null,
      date: t.date !== null ? moment(t.date) : moment(''),
    };
  };

  const [transaction, setTransaction] = useState(
    toEditable(initialTransaction)
  );
  const stock = findStock(stocks, parseISIN(transaction.isin));

  let price = '\u2014';
  if (
    transaction.units !== null &&
    transaction.amount !== null &&
    transaction.units !== 0.0
  )
    price = `${((-1 * transaction.amount) / transaction.units).toFixed(2)}€`;

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

  const onDelete = () => {
    setConfirmOpen(false);

    // TODO: DELETE transaction
    console.log(`delete: ${transaction.id}`);

    onClose();
  };

  const onSave = () => {
    if (toTransaction(transaction) === null) {
      setTriedToSave(true);
      return;
    }

    // TODO: POST/PUT transaction
    console.log(`post/put`);
    console.log(toTransaction(transaction));

    onClose();
  };

  return (
    <>
      <Dialog
        fullScreen={!mdUp}
        open={open}
        disableBackdropClick
        onClose={() => {
          reset();
          onClose();
        }}
        onEntered={reset}
        onEnter={reset}
      >
        <DialogTitle id="form-dialog-title">
          {transaction.id !== null
            ? 'Transaktion bearbeiten'
            : 'Transaktion erstellen'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={1}>
            <Grid item xs={12}>
              <Autocomplete
                freeSolo
                options={stocks.items}
                getOptionLabel={option => {
                  if (typeof option === 'string') return option;
                  return option.isin;
                }}
                renderOption={option => {
                  if (typeof option === 'string') return option;
                  return `${option.isin} (${abbreviateTitle(
                    option.title,
                    true
                  )})`;
                }}
                onInputChange={(e, v) =>
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
                    fullWidth
                    error={parseISIN(transaction.isin) === null}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12}>
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
                onInputChange={(e, v) =>
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
              <Grid item xs={12}>
                <Autocomplete
                  freeSolo
                  options={accounts.items}
                  getOptionLabel={option => {
                    if (typeof option === 'string') return option;
                    return option.name;
                  }}
                  autoComplete
                  openOnFocus
                  onInputChange={(e, v) =>
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
                      fullWidth
                      error={
                        findAccountByName(accounts, transaction.account) ===
                        null
                      }
                      margin="normal"
                    />
                  )}
                />
              </Grid>
            )}
            <Grid item xs={12}>
              <DateTimePicker
                label="Datum"
                fullWidth
                inputFormat="DD/MM/YYYY HH:mm"
                value={transaction.date}
                onChange={d => {
                  setTransaction({
                    ...transaction,
                    date: d !== null ? d : moment(''),
                  });
                }}
                disableFuture
                autoOk
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                margin="dense"
                label="Betrag"
                fullWidth
                value={transaction.amount}
                onChange={v => {
                  setTransaction({
                    ...transaction,
                    amount: v.target.value,
                  });
                }}
                InputProps={{
                  inputComponent: NumberInput,
                  inputProps: {
                    suffix: '€',
                    decimalScale: 2,
                    fixedDecimalScale: true,
                  },
                }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                margin="dense"
                label="Gebühren"
                fullWidth
                value={transaction.fees}
                onChange={v => {
                  setTransaction({
                    ...transaction,
                    fees: v.target.value,
                  });
                }}
                InputProps={{
                  inputComponent: NumberInput,
                  inputProps: {
                    allowNegative: false,
                    suffix: '€',
                    decimalScale: 2,
                    fixedDecimalScale: true,
                  },
                }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                margin="dense"
                label="Einheiten"
                fullWidth
                value={transaction.units}
                onChange={v => {
                  setTransaction({
                    ...transaction,
                    units: v.target.value,
                  });
                }}
                InputProps={{
                  inputComponent: NumberInput,
                  inputProps: {},
                }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                margin="dense"
                label="Kurs"
                readOnly
                disabled
                fullWidth
                value={price}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                margin="dense"
                label="Kommentare"
                fullWidth
                multiline
                test="dd"
                rows={3}
                value={transaction.comments}
                onChange={v =>
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
            <Button color="primary" onClick={() => setConfirmOpen(true)}>
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

TransactionDialog.propTypes = {
  initialTransaction: PropTypes.shape({
    id: PropTypes.number,
    comments: PropTypes.string,
    date: PropTypes.string,
    isin: PropTypes.string,
  }).isRequired,
  stocks: PropTypes.shape({
    items: PropTypes.arrayOf(PropTypes.object),
    lastUpdated: PropTypes.number,
  }).isRequired,
  accounts: PropTypes.shape({
    items: PropTypes.arrayOf(PropTypes.object),
    lastUpdated: PropTypes.number,
  }).isRequired,
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default TransactionDialog;
