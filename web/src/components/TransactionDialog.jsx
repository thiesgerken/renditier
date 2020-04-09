import React from 'react';
import PropTypes from 'prop-types';
import {
  useTheme,
  useMediaQuery,
  Dialog,
  Button,
  makeStyles,
  DialogContent,
  DialogTitle,
  DialogContentText,
  TextField,
  DialogActions,
} from '@material-ui/core';
import { DateTimePicker } from '@material-ui/pickers';
import * as moment from 'moment';
import Autocomplete from '@material-ui/lab/Autocomplete';
import { abbreviateTitle, findStock } from '../selectors/stocks';

const useStyles = makeStyles(theme => ({
  formControl: {
    marginTop: theme.spacing(1),
    // marginBottom: theme.spacing(1),
  },
}));

const TransactionDialog = ({ stocks, transaction, open, onClose, onEnter }) => {
  const stock = findStock(stocks, transaction.isin);

  const classes = useStyles();
  const theme = useTheme();
  const mdUp = useMediaQuery(theme.breakpoints.up('md'));

  const [confirmOpen, setConfirmOpen] = React.useState(false);

  return (
    <>
      <Dialog
        fullScreen={!mdUp}
        open={open}
        onClose={onClose}
        onEnter={onEnter}
      >
        <DialogTitle id="form-dialog-title">
          {transaction.id !== null
            ? 'Transaktion bearbeiten'
            : 'Transaktion erstellen'}
        </DialogTitle>
        <DialogContent>
          <Autocomplete
            clearOnEscape
            options={stocks.items}
            getOptionLabel={option =>
              `${option.isin} (${abbreviateTitle(option.title, true)})`
            }
            autoComplete
            openOnFocus
            className={classes.formControl}
            renderInput={params => (
              <TextField
                // eslint-disable-next-line react/jsx-props-no-spreading
                {...params}
                label="ISIN"
                fullWidth
                margin="normal"
              />
            )}
          />
          <Autocomplete
            clearOnEscape
            options={stock !== null ? stock.exchanges : []}
            getOptionLabel={option => option.name}
            autoComplete
            openOnFocus
            className={classes.formControl}
            renderInput={params => (
              <TextField
                // eslint-disable-next-line react/jsx-props-no-spreading
                {...params}
                label="Handelsplatz"
                fullWidth
                margin="normal"
              />
            )}
          />
          <DateTimePicker
            label="Datum"
            fullWidth
            inputFormat="DD/MM/YYYY HH:MM"
            value={moment(transaction.date)}
            onChange={() => {}}
            disableFuture
            className={classes.formControl}
          />
          <TextField
            margin="dense"
            id="name"
            label="Kommentare"
            fullWidth
            multiline
            autoFocus
            rows={2}
            value={transaction.comments}
            // onChange={x=> setTr}
          />
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
          <Button color="primary" onClick={onClose}>
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
        {/* <DialogTitle id="alert-dialog-title">
          {"Use Google's location service?"}
        </DialogTitle> */}
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
          <Button
            onClick={() => {
              setConfirmOpen(false);
              onClose();
            }}
            color="primary"
          >
            Ja
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

TransactionDialog.propTypes = {
  transaction: PropTypes.shape({
    id: PropTypes.number,
    comments: PropTypes.string,
    date: PropTypes.string,
    isin: PropTypes.string,
  }).isRequired,
  stocks: PropTypes.shape({
    items: PropTypes.arrayOf(PropTypes.object),
    lastUpdated: PropTypes.number,
  }).isRequired,
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onEnter: PropTypes.func.isRequired,
};

export default TransactionDialog;
