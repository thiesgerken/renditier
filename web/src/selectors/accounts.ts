import { find } from 'lodash';

import type { Account } from '../types/api';
import type { AccountsState } from '../types/store';

export const findAccount = (
  accounts: AccountsState,
  id: number | null
): Account | null => {
  if (id === null) return null;
  return find(accounts.data, x => x.id === id) ?? null;
};
