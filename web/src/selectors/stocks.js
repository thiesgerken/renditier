import { find } from 'lodash';

export const findStock = (stocks, isin) => {
  if (stocks.items === null) return null;

  return find(stocks.items, x => x.isin === isin);
};
