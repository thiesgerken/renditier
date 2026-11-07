import { sumBy } from 'lodash';

import BarList from '../BarList';
import type { BarItem } from '../BarList';

// Fund data often lists a few percent less than 100 because of rounding or
// omitted small positions; only a larger gap is worth its own row.
const ROUNDING_SLACK = 1;

interface Props {
  title: string;
  // shares in percent of the fund
  shares: BarItem[];
  maxRows: number;
}

// A fund's composition from onvista: what the listed shares leave out of the
// fund is "Unbekannt".
const CompositionBars = ({ title, shares, maxRows }: Props) => {
  const missing = 100 - sumBy(shares, 'value');

  return (
    <BarList
      title={title}
      items={shares}
      maxRows={maxRows}
      unattributed={missing > ROUNDING_SLACK ? missing : 0}
    />
  );
};

export default CompositionBars;
