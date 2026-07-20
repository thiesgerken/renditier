import moment from 'moment';

import type {
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
