import { CalendarRange, ChartArea, ChartPie, Rows3 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// The dashboard's tabs on phones and its sections on desktop, in the `?tab=`
// parameter, in order. The sidebar lists them too, as an anchor nav for the
// sections. Their labels are `dashboard.tabs.*`.
export const DASHBOARD_TABS = [
  'chart',
  'positions',
  'periods',
  'composition',
] as const;

export type DashboardTab = (typeof DASHBOARD_TABS)[number];

export const DASHBOARD_TAB_ICONS: Record<DashboardTab, LucideIcon> = {
  chart: ChartArea,
  positions: Rows3,
  periods: CalendarRange,
  composition: ChartPie,
};

// The default tab has no parameter, and a stale or mistyped one shows it too.
export const DEFAULT_TAB: DashboardTab = 'chart';

export const toDashboardTab = (param: string | null): DashboardTab =>
  DASHBOARD_TABS.find(tab => tab === param) ?? DEFAULT_TAB;

export const dashboardTabParam = (tab: DashboardTab): string | null =>
  tab === DEFAULT_TAB ? null : tab;
