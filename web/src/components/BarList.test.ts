import { barRows } from './BarList';

const item = (label: string, value: number) => ({ label, value });

describe('barRows', () => {
  it('sorts descending and gives shares of the total', () => {
    const rows = barRows([item('a', 1), item('b', 3)], 10);

    expect(rows.map(r => [r.label, r.share])).toEqual([
      ['b', 0.75],
      ['a', 0.25],
    ]);
  });

  it('folds everything beyond the top rows into "Sonstige"', () => {
    const rows = barRows(
      [item('a', 5), item('b', 4), item('c', 3), item('d', 2), item('e', 1)],
      2
    );

    expect(rows.map(r => [r.label, r.value, r.remainder])).toEqual([
      ['a', 5, false],
      ['b', 4, false],
      ['Sonstige (3)', 6, true],
    ]);
    expect(rows[2]?.title).toBe('c, d, e');
  });

  it('does not fold a single item', () => {
    const rows = barRows([item('a', 3), item('b', 2), item('c', 1)], 2);

    expect(rows.map(r => r.label)).toEqual(['a', 'b', 'c']);
  });

  it('adds the part of the total no item accounts for as "Unbekannt"', () => {
    const rows = barRows([item('a', 60)], 10, 100);

    expect(rows.map(r => [r.label, r.share, r.remainder])).toEqual([
      ['a', 0.6, false],
      ['Unbekannt', 0.4, true],
    ]);
  });

  it('keeps shares relative to the total when the rest is rounding', () => {
    const rows = barRows([item('a', 80), item('b', 19.5)], 10, 100);

    expect(rows.map(r => [r.label, r.share])).toEqual([
      ['a', 0.8],
      ['b', 0.195],
    ]);
  });

  it('keeps negative items visible instead of folding them', () => {
    const rows = barRows(
      [item('a', 6), item('b', 3), item('c', 2), item('cash', -1)],
      1
    );

    expect(rows.map(r => [r.label, r.value, r.share])).toEqual([
      ['a', 6, 0.6],
      ['Sonstige (2)', 5, 0.5],
      ['cash', -1, -0.1],
    ]);
  });

  it('has no shares when the total is not positive', () => {
    const rows = barRows([item('a', 1), item('b', -2)], 10);

    expect(rows.map(r => r.share)).toEqual([null, null]);
  });

  it('leaves out empty items', () => {
    expect(barRows([item('a', 0)], 10)).toEqual([]);
  });
});
