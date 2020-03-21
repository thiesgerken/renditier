import * as moment from 'moment';

export const getPeriodDescription = item => {
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
