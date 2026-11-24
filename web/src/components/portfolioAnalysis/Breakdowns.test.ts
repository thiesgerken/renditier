import type { Stock } from '../../types/api';
import { breakdown } from './Breakdowns';

const stock = (isin: string) => ({ isin }) as Stock;

describe('breakdown', () => {
  it('adds up a holding by its ISIN, whatever the funds call it', () => {
    const items = breakdown(
      [
        { stock: stock('FUND'), invested: 200 },
        { stock: stock('XF0000000001'), invested: 30 },
      ],
      s =>
        s.isin === 'FUND'
          ? [
              { label: 'FICTIONAL CORP', value: 10, isin: 'XF0000000001' },
              { label: 'Other Corp', value: 5, isin: 'XF0000000002' },
            ]
          : [{ label: 'Fictional Corp', value: 100, isin: 'XF0000000001' }]
    );

    expect(items.map(i => [i.label, i.value])).toEqual([
      ['FICTIONAL CORP', 50],
      ['Other Corp', 10],
    ]);
  });

  it('adds up shares without an ISIN by their name', () => {
    const items = breakdown(
      [
        { stock: stock('A'), invested: 100 },
        { stock: stock('B'), invested: 100 },
      ],
      () => [{ label: 'USA', value: 50 }]
    );

    expect(items.map(i => [i.label, i.value])).toEqual([['USA', 100]]);
  });
});
