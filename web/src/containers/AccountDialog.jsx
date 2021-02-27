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
import PropTypes from 'prop-types';
import React, { useState } from 'react';
import { connect } from 'react-redux';
import DeleteIcon from '@material-ui/icons/Delete';

import {
  deleteAccount as deleteAccountAction,
  createAccount as createAccountAction,
  updateAccount as updateAccountAction,
} from '../actions/accounts';

const AccountDialog = ({
  initialAccount,
  open,
  onClose,
  deleteAccount,
  createAccount,
  updateAccount,
}) => {
  const toIBAN = s => {
    const iban = s.trim().toUpperCase();
    if (iban === '' || /^[A-Z]{2}[0-9]{2}[0-9A-Z]{12,30}$/.test(iban))
      return iban;

    return null;
  };

  const toAccount = t => {
    const iban = toIBAN(t.iban);
    if (t.name.trim() === '' || iban === null) return null;

    const ret = {
      userId: -1,
      id: t.id,
      name: t.name.trim(),
      iban: iban !== '' ? iban : null,
    };

    return ret;
  };

  const toEditable = t => ({ ...t });

  const theme = useTheme();
  const mdUp = useMediaQuery(theme.breakpoints.up('md'));

  const [account, setAccount] = useState(toEditable(initialAccount));
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [triedToSave, setTriedToSave] = useState(false);

  const reset = () => {
    setAccount(toEditable(initialAccount));
    setTriedToSave(false);
  };

  const onDelete = () => {
    setConfirmOpen(false);
    deleteAccount(account.id);
    onClose();
  };

  const onSave = () => {
    const t = toAccount(account);

    if (t === null) {
      setTriedToSave(true);
      return;
    }

    if (t.id === null) {
      createAccount(t);
    } else {
      updateAccount(t);
    }

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
          {account.id !== null ? 'Depot bearbeiten' : 'Depot erstellen'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={1}>
            <Grid item xs={12}>
              <TextField
                margin="dense"
                label="Name"
                fullWidth
                value={account.name}
                onChange={v =>
                  setAccount({
                    ...account,
                    name: v.target.value,
                  })
                }
                error={account.name.trim() === '' && triedToSave}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                margin="dense"
                label="IBAN"
                fullWidth
                value={account.iban}
                onChange={v =>
                  setAccount({
                    ...account,
                    iban: v.target.value,
                  })
                }
                error={toIBAN(account.iban) === null && triedToSave}
              />
            </Grid>
          </Grid>
          {toAccount(account) === null && triedToSave && (
            <Alert severity="error">Depot ist unvollständig!</Alert>
          )}
        </DialogContent>
        <DialogActions>
          {account.id !== null && (
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
            Depot wirklich löschen? Dies würde auch alle Transaktionen dieses
            Depots löschen!
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

AccountDialog.propTypes = {
  initialAccount: PropTypes.shape({
    id: PropTypes.number,
  }).isRequired,
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  deleteAccount: PropTypes.func.isRequired,
  updateAccount: PropTypes.func.isRequired,
  createAccount: PropTypes.func.isRequired,
};

const mapDispatchToProps = dispatch => ({
  deleteAccount: id => dispatch(deleteAccountAction(id)),
  createAccount: t => dispatch(createAccountAction(t)),
  updateAccount: t => dispatch(updateAccountAction(t)),
});

export default connect(null, mapDispatchToProps)(AccountDialog);
