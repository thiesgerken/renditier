import { useEffect } from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import { Hash, Plus, Tag } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import DataTable, { dataTableFeatures } from '../components/DataTable';
import { Button } from '../components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import i18n from '../i18n';
import { fetchAccounts, retryAccounts } from '../slices/accounts';
import { useAppDispatch, useAppSelector } from '../store';
import useLoadFailure from '../useLoadFailure';
import type { Account } from '../types/api';
import useQueryParam from '../useQueryParam';
import AccountDialog from './AccountDialog';
import type { AccountDraft } from './AccountDialog';

const column = createColumnHelper<typeof dataTableFeatures, Account>();

// Headers are functions, so that they are translated when rendered.
const columns = column.columns([
  column.accessor('name', {
    header: () => i18n.t('common.name'),
    meta: { icon: Tag },
  }),
  column.accessor('iban', {
    header: 'IBAN',
    meta: { icon: Hash },
  }),
]);

// stable while the accounts load, so that the table keeps its row models
const NO_ACCOUNTS: Account[] = [];

const newAccount: AccountDraft = {
  id: null,
  userId: -1,
  name: '',
  iban: '',
};

const Accounts = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const accounts = useAppSelector(state => state.accounts);
  const [accountId, setAccountId] = useQueryParam('id');
  const [page, setPage] = useQueryParam('page');

  useEffect(() => {
    void dispatch(fetchAccounts());
  });
  const failure = useLoadFailure([accounts, retryAccounts()]);

  const items = accounts.data ?? NO_ACCOUNTS;
  const initialAccount =
    items.find(item => String(item.id) === accountId) ?? newAccount;

  return (
    <>
      <Card className="mx-auto max-w-(--breakpoint-xl)">
        <CardHeader>
          <CardTitle>{t('accounts.title')}</CardTitle>
          <CardAction>
            <Button size="sm" onClick={() => setAccountId(-1)}>
              <Plus />
              {t('accounts.new')}
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <DataTable
            data={items}
            columns={columns}
            getRowId={account => String(account.id)}
            initialSorting={[{ id: 'name', desc: false }]}
            isLoading={accounts.isFetching}
            failure={failure}
            emptyText={t('accounts.none')}
            pagination={{
              page: page === null ? 0 : parseInt(page, 10),
              onPageChange: p => setPage(p === 0 ? null : p),
            }}
            onRowClick={account => setAccountId(account.id)}
          />
        </CardContent>
      </Card>
      <AccountDialog
        initialAccount={initialAccount}
        open={accountId !== null && !accounts.isFetching}
        onClose={() => setAccountId(null)}
      />
    </>
  );
};

export default Accounts;
