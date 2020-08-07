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
} from '@material-ui/core';
import Alert from '@material-ui/lab/Alert';
import Autocomplete from '@material-ui/lab/Autocomplete';
import { DateTimePicker } from '@material-ui/pickers';
import { find, reverse, sortBy, sortedUniqBy } from 'lodash';
import * as moment from 'moment';
import PropTypes from 'prop-types';
import React, { useState } from 'react';
import { connect } from 'react-redux';
import DeleteIcon from '@material-ui/icons/Delete';

import {
  deleteTransaction as deleteTransactionAction,
  createTransaction as createTransactionAction,
  updateTransaction as updateTransactionAction,
} from '../actions/transactions';
import NumberInput from '../components/NumberInput';
import { findAccount, findAccountByName } from '../selectors/accounts';
import { abbreviateTitle, findStock } from '../selectors/stocks';

const TransactionDialog = ({
  stocks,
  accounts,
  initialTransaction,
  open,
  onClose,
  deleteTransaction,
  createTransaction,
  updateTransaction,
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

  const isValidFloat = s => {
    if (s === null || s === '') return false;

    const x = parseFloat(s);
    if (Number.isNaN(x) || !Number.isFinite(x)) return false;
    return true;
  };

  const toTransaction = t => {
    if (
      t.isin === null ||
      t.date === null ||
      !t.date.isValid() ||
      !isValidFloat(t.amount) ||
      !isValidFloat(t.fees) ||
      !isValidFloat(t.units)
    )
      return null;

    const tAccount = findAccountByName(accounts, t.account);
    if (tAccount === null) return null;

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
      amount: -1 * Math.round(parseFloat(t.amount) * 100),
      fees: -1 * Math.round(parseFloat(t.fees) * 100),
      accountId: tAccount.id,
      date: t.date.format(),
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
      amount: (-1 * t.amount) / 100,
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
    isValidFloat(transaction.units) &&
    isValidFloat(transaction.amount) &&
    parseFloat(transaction.units) !== 0.0
  )
    price = `${(
      parseFloat(transaction.amount) / parseFloat(transaction.units)
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

  const onDelete = () => {
    setConfirmOpen(false);
    deleteTransaction(transaction.id);
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
      updateTransaction(t);
    }

    onClose();
  };

  const badCombination =
    isValidFloat(transaction.amount) &&
    isValidFloat(transaction.fees) &&
    isValidFloat(transaction.units) &&
    parseFloat(transaction.units) === 0 &&
    Math.abs(parseFloat(transaction.amount)) +
      Math.abs(parseFloat(transaction.fees)) <
      0.01;

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
                options={stocks.data !== null ? stocks.data : []}
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
                    error={triedToSave && parseISIN(transaction.isin) === null}
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
            <Grid item xs={12}>
              <DateTimePicker
                label="Datum"
                renderInput={props => (
                  <TextField /* eslint-disable react/jsx-props-no-spreading */
                    {...props}
                  />
                )}
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
                label="Kosten"
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
                error={
                  triedToSave &&
                  (!isValidFloat(transaction.amount) || badCombination)
                }
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                margin="dense"
                label="Gebühren (zzgl.)"
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
                error={
                  triedToSave &&
                  (!isValidFloat(transaction.fees) || badCombination)
                }
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
                error={
                  triedToSave &&
                  (!isValidFloat(transaction.units) || badCombination)
                }
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

TransactionDialog.propTypes = {
  initialTransaction: PropTypes.shape({
    id: PropTypes.number,
    comments: PropTypes.string,
    date: PropTypes.string,
    isin: PropTypes.string,
  }).isRequired,
  stocks: PropTypes.shape({
    data: PropTypes.arrayOf(PropTypes.object),
    lastRequest: PropTypes.number,
  }).isRequired,
  accounts: PropTypes.shape({
    items: PropTypes.arrayOf(PropTypes.object),
  }).isRequired,
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  deleteTransaction: PropTypes.func.isRequired,
  updateTransaction: PropTypes.func.isRequired,
  createTransaction: PropTypes.func.isRequired,
};

const mapDispatchToProps = dispatch => ({
  deleteTransaction: id => dispatch(deleteTransactionAction(id)),
  createTransaction: t => dispatch(createTransactionAction(t)),
  updateTransaction: t => dispatch(updateTransactionAction(t)),
});

const mapStateToProps = state => {
  const { stocks, accounts } = state;

  return {
    stocks,
    accounts,
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(TransactionDialog);
