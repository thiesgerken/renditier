import { useState } from 'react';
import { reverse, sortBy, sortedUniqBy } from 'lodash';
import { CircleAlert, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import DatePicker from '../components/DatePicker';
import FormDialogContent from '../components/FormDialogContent';
import NumberInput from '../components/NumberInput';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { Button } from '../components/ui/button';
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { formatCurrency } from '../format';
import { findAccount } from '../selectors/accounts';
import { abbreviateTitle, findStock } from '../selectors/stocks';
import {
  createTransaction,
  deleteTransaction,
  updateTransaction,
} from '../slices/transactions';
import { useAppDispatch, useAppSelector } from '../store';
import type { Exchange, Transaction } from '../types/api';
import useChange from '../useChange';
import type { AccountsState, StocksState } from '../types/store';

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

// The dialog's form state. The numeric fields hold whatever the number inputs
// produce, so they are strings once the user has typed into them.
interface EditableTransaction {
  id: number | null;
  isin: string | null;
  exchange: string;
  comments: string;
  units: number | string;
  amount: number | string;
  fees: number | string;
  accountId: number | null;
  // In the browser's time zone, like the table shows it. Kept as a whole and
  // only changed by the date and time fields, so that an untouched transaction
  // keeps its exact instant: seconds, and the offset of a wall-clock time that
  // occurs twice when the clocks go back.
  when: Temporal.ZonedDateTime;
  receiptNumber: number | null;
}

const parseISIN = (s: string | null): string | null => {
  if (!s) return null;

  const m = s.toUpperCase().match(/^[A-Z]{2}[0-9A-Z]{10}/);
  if (m !== null && m.length === 1) return m[0];
  return null;
};

const findExchangeByName = (
  stock: { exchanges: Exchange[] } | null,
  s: string
): Exchange | null =>
  stock?.exchanges.find(
    e => e.name.toUpperCase().trim() === s.toUpperCase().trim()
  ) ?? null;

const isValidFloat = (s: string | number | null): boolean => {
  if (s === null || s === '') return false;

  const x = parseFloat(String(s));
  return !Number.isNaN(x) && Number.isFinite(x);
};

// ZonedDateTime has withPlainTime, but no counterpart for the date.
export const withDate = (
  when: Temporal.ZonedDateTime,
  { year, month, day }: Temporal.PlainDate
) => when.with({ year, month, day });

const isInFuture = (t: EditableTransaction) =>
  Temporal.Instant.compare(t.when.toInstant(), Temporal.Now.instant()) > 0;

// Neither units nor money: nothing happened.
const isEmpty = (t: EditableTransaction) =>
  isValidFloat(t.amount) &&
  isValidFloat(t.fees) &&
  isValidFloat(t.units) &&
  parseFloat(String(t.units)) === 0 &&
  Math.abs(parseFloat(String(t.amount))) +
    Math.abs(parseFloat(String(t.fees))) <
    0.01;

export const toTransaction = (
  t: EditableTransaction,
  accounts: AccountsState,
  stocks: StocksState
): TransactionPayload | null => {
  const account = findAccount(accounts, t.accountId);
  if (
    account === null ||
    t.isin === null ||
    isInFuture(t) ||
    !isValidFloat(t.amount) ||
    !isValidFloat(t.fees) ||
    !isValidFloat(t.units) ||
    isEmpty(t)
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
    accountId: account.id,
    date: t.when.toInstant().toString(),
    receiptNumber: t.receiptNumber,
  };

  if (t.exchange.trim() !== '') {
    const ex = findExchangeByName(findStock(stocks, t.isin), t.exchange);

    if (ex === null || ex.onvistaExchangeId === null) {
      ret.exchange = t.exchange.trim();
    } else {
      ret.onvistaExchangeId = ex.onvistaExchangeId;
    }
  }

  return ret;
};

export const toEditable = (
  t: TransactionDraft,
  stocks: StocksState
): EditableTransaction => {
  const stock = t.isin !== null ? findStock(stocks, t.isin) : null;

  let exchange = t.exchange ?? '';
  if (t.id !== null && t.onvistaExchangeId !== null)
    exchange = stock
      ? (stock.exchanges.find(e => e.onvistaExchangeId === t.onvistaExchangeId)
          ?.name ?? '')
      : `${t.onvistaExchangeId}`;

  return {
    id: t.id,
    isin: t.isin,
    exchange,
    comments: t.comments,
    units: t.units,
    amount: (-1 * t.amount) / 100,
    fees: (-1 * t.fees) / 100,
    accountId: t.accountId,
    when: Temporal.Instant.from(t.date).toZonedDateTimeISO(
      Temporal.Now.timeZoneId()
    ),
    receiptNumber: t.receiptNumber,
  };
};

interface Props {
  initialTransaction: TransactionDraft;
  open: boolean;
  onClose: () => void;
}

// Mounted only while the dialog is open, so every opening starts from
// `initialTransaction` again.
const TransactionForm = ({
  initialTransaction,
  onClose,
}: Omit<Props, 'open'>) => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const stocks = useAppSelector(state => state.stocks);
  const accounts = useAppSelector(state => state.accounts);
  const [transaction, setTransaction] = useState(() =>
    toEditable(initialTransaction, stocks)
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [triedToSave, setTriedToSave] = useState(false);
  const { failure, pending, run } = useChange(onClose);

  const update = (changes: Partial<EditableTransaction>) =>
    setTransaction({ ...transaction, ...changes });

  const parsedISIN = parseISIN(transaction.isin);
  const stock = parsedISIN !== null ? findStock(stocks, parsedISIN) : null;
  const exchangeNames = stock
    ? reverse(sortedUniqBy(sortBy(stock.exchanges, 'name'), x => x.name)).map(
        x => x.name
      )
    : [];

  const price =
    isValidFloat(transaction.units) &&
    isValidFloat(transaction.amount) &&
    parseFloat(String(transaction.units)) !== 0
      ? formatCurrency(
          parseFloat(String(transaction.amount)) /
            parseFloat(String(transaction.units)),
          { digits: 4 }
        )
      : '—';

  const empty = isEmpty(transaction);
  const invalidNumber = (value: string | number) =>
    triedToSave && (!isValidFloat(value) || empty);

  const onDelete = () => {
    // The delete button only renders when `transaction.id !== null`.
    if (transaction.id !== null)
      void run(
        dispatch(deleteTransaction(transaction.id)),
        t('common.deleteFailed')
      );
  };

  const onSave = () => {
    const payload = toTransaction(transaction, accounts, stocks);

    if (payload === null) {
      setTriedToSave(true);
      return;
    }

    void run(
      payload.id === null
        ? dispatch(createTransaction(payload))
        : dispatch(updateTransaction({ ...payload, id: payload.id })),
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
            {transaction.id !== null
              ? t('transactions.dialog.edit')
              : t('transactions.dialog.create')}
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-x-3 gap-y-4">
          <div className="col-span-2 grid gap-2">
            <Label htmlFor="transaction-isin">ISIN</Label>
            <Input
              id="transaction-isin"
              list="transaction-isins"
              autoComplete="off"
              value={transaction.isin ?? ''}
              onChange={event => update({ isin: event.target.value })}
              aria-invalid={triedToSave && parsedISIN === null}
            />
            <datalist id="transaction-isins">
              {(stocks.data ?? []).map(s => (
                <option key={s.isin} value={s.isin}>
                  {abbreviateTitle(s.title, true)}
                </option>
              ))}
            </datalist>
          </div>
          <div className="col-span-2 grid gap-2">
            <Label htmlFor="transaction-exchange">
              {t('transactions.dialog.exchange')}
            </Label>
            <Input
              id="transaction-exchange"
              list="transaction-exchanges"
              autoComplete="off"
              value={transaction.exchange}
              onChange={event => update({ exchange: event.target.value })}
            />
            <datalist id="transaction-exchanges">
              {exchangeNames.map(name => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>
          {((accounts.data ?? []).length > 1 ||
            findAccount(accounts, transaction.accountId) === null) && (
            <div className="col-span-2 grid gap-2">
              <Label htmlFor="transaction-account">
                {t('transactions.dialog.account')}
              </Label>
              <Select
                value={
                  transaction.accountId === null
                    ? undefined
                    : String(transaction.accountId)
                }
                onValueChange={value => update({ accountId: Number(value) })}
              >
                <SelectTrigger
                  id="transaction-account"
                  className="w-full"
                  aria-invalid={
                    triedToSave &&
                    findAccount(accounts, transaction.accountId) === null
                  }
                >
                  <SelectValue
                    placeholder={t('transactions.dialog.pickAccount')}
                  />
                </SelectTrigger>
                <SelectContent>
                  {(accounts.data ?? []).map(account => (
                    <SelectItem key={account.id} value={String(account.id)}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="transaction-date">{t('common.date')}</Label>
            <DatePicker
              id="transaction-date"
              value={transaction.when.toPlainDate()}
              max={Temporal.Now.plainDateISO()}
              onChange={date =>
                update({ when: withDate(transaction.when, date) })
              }
              invalid={triedToSave && isInFuture(transaction)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="transaction-time">
              {t('transactions.dialog.time')}
            </Label>
            <Input
              id="transaction-time"
              type="time"
              required
              value={transaction.when
                .toPlainTime()
                .toString({ smallestUnit: 'minute' })}
              onChange={event => {
                // A cleared field keeps the last time; a transaction has one.
                if (event.target.value === '') return;
                update({
                  when: transaction.when.withPlainTime(
                    Temporal.PlainTime.from(event.target.value)
                  ),
                });
              }}
              aria-invalid={triedToSave && isInFuture(transaction)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="transaction-amount">
              {t('transactions.dialog.amount')}
            </Label>
            <NumberInput
              id="transaction-amount"
              value={transaction.amount}
              onValueChange={amount => update({ amount })}
              suffix=" €"
              decimalScale={2}
              fixedDecimalScale
              aria-invalid={invalidNumber(transaction.amount)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="transaction-fees">
              {t('transactions.dialog.fees')}
            </Label>
            <NumberInput
              id="transaction-fees"
              value={transaction.fees}
              onValueChange={fees => update({ fees })}
              allowNegative={false}
              suffix=" €"
              decimalScale={2}
              fixedDecimalScale
              aria-invalid={invalidNumber(transaction.fees)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="transaction-units">
              {t('transactions.dialog.units')}
            </Label>
            <NumberInput
              id="transaction-units"
              value={transaction.units}
              onValueChange={units => update({ units })}
              aria-invalid={invalidNumber(transaction.units)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="transaction-price">
              {t('transactions.dialog.price')}
            </Label>
            <Input id="transaction-price" value={price} disabled />
          </div>
          <div className="col-span-2 grid gap-2">
            <Label htmlFor="transaction-comments">
              {t('transactions.dialog.comments')}
            </Label>
            <Textarea
              id="transaction-comments"
              rows={3}
              value={transaction.comments}
              onChange={event => update({ comments: event.target.value })}
            />
          </div>
        </div>
        {toTransaction(transaction, accounts, stocks) === null &&
          triedToSave && (
            <Alert variant="destructive">
              <CircleAlert />
              <AlertDescription>
                {t('transactions.dialog.incomplete')}
              </AlertDescription>
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
          {transaction.id !== null && (
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
            <AlertDialogTitle>
              {t('transactions.dialog.confirmDelete')}
            </AlertDialogTitle>
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

const TransactionDialog = ({ initialTransaction, open, onClose }: Props) => (
  <Dialog open={open} onOpenChange={isOpen => !isOpen && onClose()}>
    <FormDialogContent className="md:max-w-lg">
      <TransactionForm
        initialTransaction={initialTransaction}
        onClose={onClose}
      />
    </FormDialogContent>
  </Dialog>
);

export default TransactionDialog;
