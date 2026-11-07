import { toAccount } from './AccountDialog';

const draft = { id: 1, userId: 1, name: 'Depot', iban: null };

describe('toAccount', () => {
  it('rejects an invalid IBAN instead of dropping it', () => {
    expect(toAccount({ ...draft, iban: 'DE12 kaputt' })).toBeNull();
  });

  it('normalizes a valid IBAN and turns an empty one into null', () => {
    expect(
      toAccount({ ...draft, iban: ' de89370400440532013000 ' })?.iban
    ).toBe('DE89370400440532013000');
    expect(toAccount({ ...draft, iban: '' })?.iban).toBeNull();
  });
});
