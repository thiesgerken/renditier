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
import React, { useState } from 'react';
import { connect } from 'react-redux';
import type { ConnectedProps } from 'react-redux';
import DeleteIcon from '@mui/icons-material/Delete';

import {
  deleteAccount as deleteAccountAction,
  createAccount as createAccountAction,
  updateAccount as updateAccountAction,
} from '../slices/accounts';
import type { AppDispatch } from '../store';
import type { Account } from '../types/api';

// The dialog doubles as the "create" form, where there is no id yet.
export type AccountDraft = Omit<Account, 'id'> & { id: number | null };

const AccountDialog = ({
  initialAccount,
  open,
  onClose,
  deleteAccount,
  createAccount,
  updateAccount,
}: Props) => {
  const toIBAN = (s: string | null): string | null => {
    if (s === null) return null;

    const iban = s.trim().toUpperCase();
    if (iban === '' || /^[A-Z]{2}[0-9]{2}[0-9A-Z]{12,30}$/.test(iban))
      return iban;

    return null;
  };

  const toAccount = (t: AccountDraft): AccountDraft | null => {
    const iban = toIBAN(t.iban);
    if (t.name.trim() === '') return null;

    const ret = {
      userId: -1,
      id: t.id,
      name: t.name.trim(),
      iban: iban !== '' ? iban : null,
    };

    return ret;
  };

  const toEditable = (t: AccountDraft): AccountDraft => ({ ...t });

  const theme = useTheme();
  const mdUp = useMediaQuery(theme.breakpoints.up('md'));

  const [account, setAccount] = useState(toEditable(initialAccount));
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [triedToSave, setTriedToSave] = useState(false);

  const reset = () => {
    setAccount(toEditable(initialAccount));
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
    // The delete button only renders when `account.id !== null`.
    if (account.id !== null) deleteAccount(account.id);
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
      updateAccount({ ...t, id: t.id });
    }

    onClose();
  };

  return (
    <>
      <Dialog fullScreen={!mdUp} open={open} onClose={handleDialogClose}>
        <DialogTitle id="form-dialog-title">
          {account.id !== null ? 'Depot bearbeiten' : 'Depot erstellen'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={1}>
            <Grid size={12}>
              <TextField
                margin="dense"
                label="Name"
                variant="standard"
                fullWidth
                value={account.name}
                onChange={(v: React.ChangeEvent<HTMLInputElement>) =>
                  setAccount({
                    ...account,
                    name: v.target.value,
                  })
                }
                error={account.name.trim() === '' && triedToSave}
              />
            </Grid>
            <Grid size={12}>
              <TextField
                margin="dense"
                label="IBAN"
                variant="standard"
                fullWidth
                value={account.iban || ''}
                onChange={(v: React.ChangeEvent<HTMLInputElement>) =>
                  setAccount({
                    ...account,
                    iban: v.target.value !== '' ? v.target.value : null,
                  })
                }
                error={
                  toIBAN(account.iban) === null &&
                  account.iban !== null &&
                  triedToSave
                }
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
            // eslint-disable-next-line jsx-a11y/no-autofocus -- the safe choice of a destructive confirmation
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
  deleteAccount: (id: number) => dispatch(deleteAccountAction(id)),
  createAccount: (t: AccountDraft) => dispatch(createAccountAction(t)),
  updateAccount: (t: Account) => dispatch(updateAccountAction(t)),
});

const connector = connect(null, mapDispatchToProps);

type Props = ConnectedProps<typeof connector> & {
  initialAccount: AccountDraft;
  open: boolean;
  onClose: () => void;
};

export default connector(AccountDialog);
