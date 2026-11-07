import { CircleMinus, CirclePlus, HandCoins, Receipt } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import i18n from '../i18n';
import type { Transaction } from '../types/api';

interface Kind {
  label: string;
  icon: LucideIcon;
  className: string;
}

// Transactions without units only move money: dividends, or fees booked on
// their own (e.g. a fund's custody fee) when there is no amount besides them.
// The colours (tokens in index.css) stay clear of green and berry, which mean
// gain and loss in the amounts next to them, and of the brand orange.
export const kindOf = ({
  units,
  amount,
}: Pick<Transaction, 'units' | 'amount'>): Kind => {
  if (units > 0)
    return {
      label: i18n.t('transactions.kinds.buy'),
      icon: CirclePlus,
      className: 'text-kind-buy',
    };
  if (units < 0)
    return {
      label: i18n.t('transactions.kinds.sell'),
      icon: CircleMinus,
      className: 'text-kind-sell',
    };
  if (amount === 0)
    return {
      label: i18n.t('transactions.kinds.fee'),
      // the icon of the fees KPI
      icon: Receipt,
      className: 'text-kind-fee',
    };
  return {
    label: i18n.t('transactions.kinds.dividend'),
    icon: HandCoins,
    className: 'text-kind-dividend',
  };
};

export const KindIcon = ({ transaction }: { transaction: Transaction }) => {
  const { label, icon: Icon, className } = kindOf(transaction);
  return (
    <span title={label}>
      <Icon aria-hidden className={`size-4 ${className}`} />
      <span className="sr-only">{label}</span>
    </span>
  );
};
