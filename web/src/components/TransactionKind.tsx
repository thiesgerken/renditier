import { CircleMinus, CirclePlus, HandCoins } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { Transaction } from '../types/api';

interface Kind {
  label: string;
  icon: LucideIcon;
  className: string;
}

// Transactions without units only move money: dividends. The colours stay
// clear of teal and pink, which mean gain and loss in the amounts next to them.
export const kindOf = ({ units }: Pick<Transaction, 'units'>): Kind => {
  if (units > 0)
    return {
      label: 'Kauf',
      icon: CirclePlus,
      className: 'text-sky-600 dark:text-sky-400',
    };
  if (units < 0)
    return {
      label: 'Verkauf',
      icon: CircleMinus,
      className: 'text-violet-600 dark:text-violet-400',
    };
  return {
    label: 'Dividende',
    icon: HandCoins,
    className: 'text-amber-600 dark:text-amber-400',
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
