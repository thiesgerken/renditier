import { kindOf } from './TransactionKind';

describe('kindOf', () => {
  it('tells the kinds apart by units, then by amount', () => {
    expect(kindOf({ units: 3, amount: -30000 }).label).toBe('Kauf');
    expect(kindOf({ units: -3, amount: 31000 }).label).toBe('Verkauf');
    expect(kindOf({ units: 0, amount: 2350 }).label).toBe('Dividende');
    // e.g. a gold ETC's custody fee, which is all in `fees`
    expect(kindOf({ units: 0, amount: 0 }).label).toBe('Gebühr');
  });
});
