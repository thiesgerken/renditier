import moment from 'moment';

import type {
  DataSource,
  EitherPrice,
  IsoDate,
  PerformanceKind,
  PortfolioPerformance,
  PositionPerformance,
} from '../types/api';

// Called both with a whole-portfolio period and with a single position's
// performance for that period, which containers/StockAnalysis builds by
// spreading the position next to the portfolio period's `kind`.
export type PerformancePeriod =
  PortfolioPerformance | (PositionPerformance & { kind: PerformanceKind });

export const getPeriodDescription = (item: PerformancePeriod): string => {
  switch (item.kind) {
    case 'Total':
      return 'Insgesamt';
    case 'Today':
      return 'Heute';
    case 'WeekToDate':
      return 'Diese Woche';
    case 'MonthToDate':
      return 'Dieser Monat';
    case 'YearToDate':
      return 'Dieses Jahr';
    case 'YearToYear':
      return moment(item.end.date).format('YYYY');
    case 'MonthToMonth':
      return moment(item.end.date).format('MM/YYYY');
    default:
      return '';
  }
};

export const getPrice = (
  dataSource: DataSource<EitherPrice> | null
): number | null => {
  if (dataSource === null) return null;

  return dataSource.price.type === 'RealtimePrice'
    ? dataSource.price.price
    : dataSource.price.closing;
};

const nextWeekDay = (date: moment.Moment): moment.Moment => {
  const d = moment(date);
  while (d.day() === 0 || d.day() === 6) d.add(1, 'days');
  return d;
};

// The plotted range of a period. A period's start date is the last day before
// it, whose closing prices it compares against, so the plot starts on the next
// trading day.
export const getPeriodRange = (
  period: PortfolioPerformance
): [IsoDate, IsoDate] => [
  nextWeekDay(moment(period.start.date).add(1, 'days')).format('YYYY-MM-DD'),
  period.end.date,
];
