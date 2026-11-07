// The dashboard's tabs, in the `?tab=` parameter. The sidebar lists them too,
// so that desktop needs no tab list on the page.
// Short enough for all four to fit next to each other on a phone.
export const DASHBOARD_TABS = {
  chart: 'Entwicklung',
  positions: 'Positionen',
  periods: 'Zeiträume',
  composition: 'Anteile',
};

export type DashboardTab = keyof typeof DASHBOARD_TABS;

// The default tab has no parameter, and a stale or mistyped one shows it too.
export const DEFAULT_TAB: DashboardTab = 'chart';

export const toDashboardTab = (param: string | null): DashboardTab =>
  param !== null && param in DASHBOARD_TABS
    ? (param as DashboardTab)
    : DEFAULT_TAB;

export const dashboardTabParam = (tab: string): string | null =>
  tab === DEFAULT_TAB ? null : tab;
