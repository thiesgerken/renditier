import { find } from 'lodash';

export const findAccount = (accounts, id) => {
  if (accounts.items === null || id === null) return null;
  return find(accounts.items, x => x.id === id) || null;
};

export const findAccountByName = (accounts, name) => {
  if (accounts.items === null || name === null) return null;
  return (
    find(
      accounts.items,
      x => x.name.toUpperCase().trim() === name.toUpperCase().trim()
    ) || null
  );
};
