import { CalendarRange, ChartArea, ChartPie, Rows3 } from 'lucide-react';

// The dashboard's tabs, in the `?tab=` parameter. The sidebar lists them too,
// so that desktop needs no tab list on the page.
// Labels short enough for all four to fit next to each other on a phone.
export const DASHBOARD_TABS = {
  chart: { label: 'Entwicklung', icon: ChartArea },
  positions: { label: 'Positionen', icon: Rows3 },
  periods: { label: 'Zeiträume', icon: CalendarRange },
  composition: { label: 'Anteile', icon: ChartPie },
};

export type DashboardTab = keyof typeof DASHBOARD_TABS;

// The default tab has no parameter, and a stale or mistyped one shows it too.
export const DEFAULT_TAB: DashboardTab = 'chart';

export const toDashboardTab = (param: string | null): DashboardTab =>
  param !== null && Object.hasOwn(DASHBOARD_TABS, param)
    ? (param as DashboardTab)
    : DEFAULT_TAB;

export const dashboardTabParam = (tab: string): string | null =>
  tab === DEFAULT_TAB ? null : tab;
