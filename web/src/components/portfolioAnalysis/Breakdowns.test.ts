import type { Stock } from '../../types/api';
import { breakdown } from './Breakdowns';

const stock = (isin: string) => ({ isin }) as Stock;

describe('breakdown', () => {
  it('adds up a holding by its ISIN, named by its largest part', () => {
    const positions = [
      { stock: stock('FUND'), invested: 200 },
      { stock: stock('XF0000000001'), invested: 30 },
    ];
    const shares = (s: Stock) =>
      s.isin === 'FUND'
        ? [
            { label: 'FICTIONAL CORP', value: 10, isin: 'XF0000000001' },
            { label: 'Other Corp', value: 5, isin: 'XF0000000002' },
          ]
        : [{ label: 'Fictional Corp', value: 100, isin: 'XF0000000001' }];

    [positions, [...positions].reverse()].forEach(ordered => {
      const items = breakdown(ordered, shares);
      expect(items.find(i => i.isin === 'XF0000000001')).toMatchObject({
        label: 'Fictional Corp',
        value: 50,
      });
      expect(items).toHaveLength(2);
    });
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
