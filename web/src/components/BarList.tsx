import { cn } from 'cn';
import { sumBy } from 'lodash';

import { formatPercent } from '../format';

export interface BarItem {
  label: string;
  value: number;
  // shown on hover, e.g. the full name behind an abbreviated label
  title?: string;
}

export interface BarRow extends BarItem {
  // fraction of the total; null when the total is not positive, so that there
  // is nothing to be a share of
  share: number | null;
  // folded or unattributed remainder rather than an item of its own
  remainder: boolean;
}

// Below this fraction of the total, a part that no item accounts for is
// rounding in the source data rather than missing data.
const ROUNDING_SLACK = 0.01;

// The rows of a bar list: the `maxRows` largest positive items, the remaining
// positive ones folded into "Sonstige" (unless that would be a single item),
// the part of `total` that no item accounts for as "Unbekannt", and every
// negative item. Negative items are never folded, because a remainder would
// silently net them against the rest.
export const barRows = (
  items: BarItem[],
  maxRows: number,
  total = sumBy(items, 'value')
): BarRow[] => {
  const row = (item: BarItem, remainder = false): BarRow => ({
    ...item,
    share: total > 0 ? item.value / total : null,
    remainder,
  });

  const sorted = [...items].sort((a, b) => b.value - a.value);
  const positive = sorted.filter(i => i.value > 0);
  const negative = sorted.filter(i => i.value < 0);
  const shown = positive.length > maxRows + 1 ? maxRows : positive.length;
  const folded = positive.slice(shown);
  const unattributed = total - sumBy(items, 'value');

  return [
    ...positive.slice(0, shown).map(i => row(i)),
    ...(folded.length > 0
      ? [
          row(
            {
              label: `Sonstige (${folded.length})`,
              value: sumBy(folded, 'value'),
              title: folded.map(i => i.label).join(', '),
            },
            true
          ),
        ]
      : []),
    ...(total > 0 && unattributed > ROUNDING_SLACK * total
      ? [row({ label: 'Unbekannt', value: unattributed }, true)]
      : []),
    ...negative.map(i => row(i)),
  ];
};

interface Props {
  title: string;
  items: BarItem[];
  maxRows: number;
  // what the shares are relative to, e.g. 100 for a fund's composition in
  // percent; the items' sum by default
  total?: number;
  // formats an item's value; without it, only the share is shown
  formatValue?: (value: number) => string;
  // shown below the list, e.g. what could not be included
  note?: string;
}

// A horizontal bar per item, longest first; negative items get the loss
// color.
const BarList = ({
  title,
  items,
  maxRows,
  total,
  formatValue,
  note,
}: Props) => {
  const rows = barRows(items, maxRows, total);
  if (rows.length === 0) return null;

  // Bars are scaled to the largest item, so that a large "Unbekannt" does not
  // squash the items; a remainder beyond that fills the row.
  const itemRows = rows.filter(r => !r.remainder);
  const largest = Math.max(
    ...(itemRows.length > 0 ? itemRows : rows).map(r => Math.abs(r.value))
  );
  const barWidth = (r: BarRow) =>
    `${Math.min(1, Math.abs(r.value) / largest) * 100}%`;

  const barColor = (r: BarRow): string => {
    if (r.value < 0) return 'bg-loss';
    return r.remainder ? 'bg-muted-foreground/30' : 'bg-primary';
  };

  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-medium">{title}</h3>
      <div
        className={cn(
          'grid items-baseline gap-x-3 text-sm tabular-nums',
          formatValue
            ? 'grid-cols-[minmax(0,1fr)_auto_auto]'
            : 'grid-cols-[minmax(0,1fr)_auto]'
        )}
      >
        {rows.map(r => (
          <div key={r.label} className="contents">
            <span
              title={r.title}
              className={cn('truncate', r.remainder && 'text-muted-foreground')}
            >
              {r.label}
            </span>
            {formatValue && (
              <span className="text-right">{formatValue(r.value)}</span>
            )}
            <span className="text-right text-muted-foreground">
              {formatPercent(r.share, { digits: 1 })}
            </span>
            <div
              className={cn(
                'col-span-full mb-2 h-1.5 rounded-full',
                barColor(r)
              )}
              style={{ width: barWidth(r) }}
            />
          </div>
        ))}
      </div>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </div>
  );
};

export default BarList;
