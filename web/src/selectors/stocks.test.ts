import { SECTOR_ICONS } from '../components/breakdowns';
import type { Stock } from '../types/api';
import { breakdownShares, holdingShares, normalizeIndustry } from './stocks';

// onvista stores the JSON `null` for some funds instead of leaving the column
// empty; both must read as "no data".
const stock = (raw: string | null) =>
  ({ currencyBreakdown: raw, holdings: raw }) as Stock;

describe('onvista columns', () => {
  it.each([null, 'null'])('treat %s as no data', raw => {
    expect(breakdownShares(stock(raw), 'currencyBreakdown')).toEqual([]);
    expect(holdingShares(stock(raw))).toBeNull();
  });

  it('normalizes country names only', () => {
    const raw = JSON.stringify([
      { nameBreakdown: 'Vereinigte Staaten', investmentPct: 60 },
    ]);
    const s = { countryBreakdown: raw, industryBreakdown: raw } as Stock;

    expect(breakdownShares(s, 'countryBreakdown')).toEqual([
      { label: 'USA', value: 60 },
    ]);
    expect(breakdownShares(s, 'industryBreakdown')).toEqual([
      { label: 'Vereinigte Staaten', value: 60 },
    ]);
  });
});

describe('industry names', () => {
  const industries = (entries: [string, number][]) =>
    breakdownShares(
      {
        industryBreakdown: JSON.stringify(
          entries.map(([nameBreakdown, investmentPct]) => ({
            nameBreakdown,
            investmentPct,
          }))
        ),
      } as Stock,
      'industryBreakdown'
    );

  it('maps GICS and sub-names onto the broad sectors and adds them up', () => {
    expect(
      industries([
        ['Informationstechnologie', 20],
        ['Telekomdienste', 5],
        ['Basiskonsumgüter', 6],
        ['Konsumgüter zyklisch', 9],
        ['Versorger umfassend', 30],
        ['Vesorger/Strom konventionell/ Enegiefirmen', 10],
        ['Halbleiterelektronik', 20],
      ])
    ).toEqual([
      { label: 'IT/Telekommunikation', value: 25 },
      { label: 'Konsumgüter', value: 15 },
      { label: 'Versorger', value: 40 },
      { label: 'Halbleiterelektronik', value: 20 },
    ]);
  });

  it('keeps every former sector name on an icon', () => {
    for (const name of [
      'Informationstechnologie',
      'Telekomdienste',
      'Basiskonsumgüter',
      'Konsumgüter zyklisch',
      'Versorger umfassend',
    ])
      expect(SECTOR_ICONS[normalizeIndustry(name)]).toBeDefined();
  });
});
