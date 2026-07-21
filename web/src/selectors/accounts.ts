import { find } from 'lodash';

import type { Account } from '../types/api';
import type { AccountsState } from '../types/store';

// FIXME(tsx-migration): dropped a dead `if (accounts.items === null)` guard —
// the reducer initialises `items` to [] and never stores null.
export const findAccount = (
  accounts: AccountsState,
  id: number | null
): Account | null => {
  if (id === null) return null;
  return find(accounts.items, x => x.id === id) || null;
};

// FIXME(tsx-migration): same dead `accounts.items === null` guard dropped here.
export const findAccountByName = (
  accounts: AccountsState,
  name: string | null
): Account | null => {
  if (name === null) return null;
  return (
    find(
      accounts.items,
      x => x.name.toUpperCase().trim() === name.toUpperCase().trim()
    ) || null
  );
};
