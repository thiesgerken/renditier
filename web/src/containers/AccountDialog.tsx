import { useState } from 'react';
import { CircleAlert, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { Button } from '../components/ui/button';
import FormDialogContent from '../components/FormDialogContent';
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  deleteAccount,
  createAccount,
  updateAccount,
} from '../slices/accounts';
import { useAppDispatch } from '../store';
import type { Account } from '../types/api';
import useChange from '../useChange';

// The dialog doubles as the "create" form, where there is no id yet.
export type AccountDraft = Omit<Account, 'id'> & { id: number | null };

interface Props {
  initialAccount: AccountDraft;
  open: boolean;
  onClose: () => void;
}

const toIBAN = (s: string | null): string | null => {
  if (s === null) return null;

  const iban = s.trim().toUpperCase();
  if (iban === '' || /^[A-Z]{2}[0-9]{2}[0-9A-Z]{12,30}$/.test(iban))
    return iban;

  return null;
};

export const toAccount = (t: AccountDraft): AccountDraft | null => {
  const iban = toIBAN(t.iban);
  if (t.name.trim() === '' || (t.iban !== null && iban === null)) return null;

  return {
    userId: -1,
    id: t.id,
    name: t.name.trim(),
    iban: iban !== '' ? iban : null,
  };
};

// Mounted only while the dialog is open, so every opening starts from
// `initialAccount` again.
const AccountForm = ({ initialAccount, onClose }: Omit<Props, 'open'>) => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [account, setAccount] = useState(initialAccount);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [triedToSave, setTriedToSave] = useState(false);
  const { failure, pending, run } = useChange(onClose);

  const onDelete = () => {
    // The delete button only renders when `account.id !== null`.
    if (account.id !== null)
      void run(dispatch(deleteAccount(account.id)), t('common.deleteFailed'));
  };

  const onSave = () => {
    const draft = toAccount(account);

    if (draft === null) {
      setTriedToSave(true);
      return;
    }

    void run(
      draft.id === null
        ? dispatch(createAccount(draft))
        : dispatch(updateAccount({ ...draft, id: draft.id })),
      t('common.saveFailed')
    );
  };

  return (
    <>
      <form
        className="flex flex-1 flex-col gap-4"
        onSubmit={event => {
          event.preventDefault();
          onSave();
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {account.id !== null ? t('accounts.edit') : t('accounts.create')}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="account-name">{t('common.name')}</Label>
          <Input
            id="account-name"
            value={account.name}
            onChange={event =>
              setAccount({ ...account, name: event.target.value })
            }
            aria-invalid={account.name.trim() === '' && triedToSave}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="account-iban">IBAN</Label>
          <Input
            id="account-iban"
            value={account.iban ?? ''}
            onChange={event =>
              setAccount({
                ...account,
                iban: event.target.value !== '' ? event.target.value : null,
              })
            }
            aria-invalid={
              toIBAN(account.iban) === null &&
              account.iban !== null &&
              triedToSave
            }
          />
        </div>
        {toAccount(account) === null && triedToSave && (
          <Alert variant="destructive">
            <CircleAlert />
            <AlertDescription>{t('accounts.incomplete')}</AlertDescription>
          </Alert>
        )}
        {failure !== null && (
          <Alert variant="destructive">
            <CircleAlert />
            <AlertTitle>{failure.title}</AlertTitle>
            <AlertDescription>{failure.message}</AlertDescription>
          </Alert>
        )}
        <DialogFooter className="mt-auto">
          {account.id !== null && (
            <Button
              type="button"
              variant="destructive"
              className="sm:mr-auto"
              disabled={pending}
              onClick={() => setConfirmOpen(true)}
            >
              <Trash2 />
              {t('common.delete')}
            </Button>
          )}
          <Button type="button" variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={pending}>
            {t('common.save')}
          </Button>
        </DialogFooter>
      </form>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('accounts.confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('accounts.deleteWarning')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.no')}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={onDelete}>
              {t('common.confirmDelete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

const AccountDialog = ({ initialAccount, open, onClose }: Props) => (
  <Dialog open={open} onOpenChange={isOpen => !isOpen && onClose()}>
    <FormDialogContent>
      <AccountForm initialAccount={initialAccount} onClose={onClose} />
    </FormDialogContent>
  </Dialog>
);

export default AccountDialog;
