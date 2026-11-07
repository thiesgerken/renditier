import type { AccountsState, StocksState } from '../types/store';
import { toEditable, toTransaction, withDate } from './TransactionDialog';

const accounts: AccountsState = {
  isFetching: false,
  didInvalidate: false,
  data: [{ id: 7, userId: 1, name: 'Depot', iban: null }],
  error: null,
  lastRequest: null,
};

const stocks: StocksState = {
  isFetching: false,
  didInvalidate: false,
  data: [],
  error: null,
  lastRequest: null,
};

const stored = {
  id: 1,
  accountId: 7,
  isin: 'IE00BK5BQT80',
  date: '2026-03-01T10:30:15Z',
  units: 2,
  amount: -15000,
  fees: -100,
  comments: '',
  onvistaExchangeId: null,
  exchange: 'Xetra',
  receiptNumber: 42,
};

describe('the transaction form', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps a time that occurs twice when the clocks go back', () => {
    vi.spyOn(Temporal.Now, 'timeZoneId').mockReturnValue('Europe/Berlin');
    // 02:30 CET, the second 02:30 of that night in Berlin
    const late = { ...stored, date: '2026-10-25T01:30:00Z' };

    expect(
      toTransaction(toEditable(late, stocks), accounts, stocks)?.date
    ).toBe(late.date);
  });

  it('saves an untouched transaction unchanged, seconds included', () => {
    expect(toTransaction(toEditable(stored, stocks), accounts, stocks)).toEqual(
      stored
    );
  });

  it('takes an edited time as local wall-clock time', () => {
    const edited = {
      ...toEditable(stored, stocks),
      when: withDate(
        toEditable(stored, stocks).when,
        Temporal.PlainDate.from('2026-02-14')
      ).withPlainTime(Temporal.PlainTime.from('09:05')),
    };
    const expected = Temporal.ZonedDateTime.from({
      year: 2026,
      month: 2,
      day: 14,
      hour: 9,
      minute: 5,
      timeZone: Temporal.Now.timeZoneId(),
    }).toInstant();

    expect(toTransaction(edited, accounts, stocks)?.date).toBe(
      expected.toString()
    );
  });

  it('rejects a date in the future', () => {
    const tomorrow = Temporal.Now.plainDateISO().add({ days: 1 });
    const draft = toEditable(stored, stocks);
    const edited = { ...draft, when: withDate(draft.when, tomorrow) };

    expect(toTransaction(edited, accounts, stocks)).toBeNull();
  });
});
