import { Fragment } from 'react';
import type { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from 'cn';
import {
  ArrowLeftRight,
  ChartLine,
  CircleUser,
  Landmark,
  LayoutDashboard,
  LogOut,
  RefreshCw,
  Settings,
  TrendingUp,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { ignoreUpdate } from '../slices/notifications';
import { useAppDispatch, useAppSelector } from '../store';
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from '../components/ui/alert';
import { Button } from '../components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import {
  DASHBOARD_TABS,
  dashboardTabParam,
  toDashboardTab,
} from './dashboardTabs';
import type { DashboardTab } from './dashboardTabs';

// `path` is the first segment of the route.
interface Destination {
  path: string;
  label: string;
  icon: LucideIcon;
}

const ANALYSIS: Destination = {
  path: 'dashboard',
  label: 'Analyse',
  icon: LayoutDashboard,
};

// Four, so that the phone's tab bar has room for every label at 360px.
const DESTINATIONS: Destination[] = [
  ANALYSIS,
  { path: 'stocks', label: 'Wertpapiere', icon: ChartLine },
  { path: 'transactions', label: 'Transaktionen', icon: ArrowLeftRight },
  { path: 'accounts', label: 'Depots', icon: Landmark },
];

const SETTINGS: Destination = {
  path: 'settings',
  label: 'Einstellungen',
  icon: Settings,
};

// The dashboard is also the page for every unknown path, "/" included.
const currentDestination = (pathname: string) => {
  const segment = pathname.split('/')[1];
  return [...DESTINATIONS, SETTINGS].some(d => d.path === segment)
    ? segment
    : 'dashboard';
};

const Brand = () => (
  <div className="flex items-center gap-2 font-semibold">
    <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
      <TrendingUp className="size-4" />
    </span>
    Aktienverwaltung
  </div>
);

interface LinkProps {
  destination: Destination;
  active: boolean;
}

const SidebarLink = ({ destination, active }: LinkProps) => (
  <Link
    to={`/${destination.path}`}
    aria-current={active ? 'page' : undefined}
    className={cn(
      'flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
      active && 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
    )}
  >
    <destination.icon
      className={cn('size-4', active && 'text-sidebar-primary')}
    />
    {destination.label}
  </Link>
);

interface DashboardTabLinksProps {
  // null when the dashboard isn't the current page
  active: DashboardTab | null;
}

// The dashboard's sections below "Analyse", highlighted while in view. On the
// dashboard a click scrolls to the section and replaces the history entry, like
// the scroll spy does, so that back leaves the page instead of stepping through
// the sections.
const DashboardTabLinks = ({ active }: DashboardTabLinksProps) => (
  <div className="ml-5 flex flex-col gap-0.5 border-l pl-2">
    {Object.entries(DASHBOARD_TABS).map(([tab, { label, icon: Icon }]) => {
      const param = dashboardTabParam(tab);

      return (
        <Link
          key={tab}
          to={param === null ? '/dashboard' : `/dashboard?tab=${param}`}
          replace={active !== null}
          aria-current={tab === active ? 'true' : undefined}
          className={cn(
            'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
            tab === active && 'font-medium text-sidebar-primary'
          )}
        >
          <Icon className="size-3.5" />
          {label}
        </Link>
      );
    })}
  </div>
);

const TabBarLink = ({ destination, active }: LinkProps) => (
  <Link
    to={`/${destination.path}`}
    aria-current={active ? 'page' : undefined}
    className={cn(
      'flex flex-col items-center gap-1 pt-2 pb-1.5 text-[0.7rem] text-muted-foreground',
      active && 'font-medium text-primary'
    )}
  >
    <span
      className={cn(
        'flex h-7 w-14 items-center justify-center rounded-full transition-colors',
        active && 'bg-primary/10'
      )}
    >
      <destination.icon className="size-5" />
    </span>
    {destination.label}
  </Link>
);

interface UserMenuProps {
  name: string | null;
  // The phone's trigger is only an icon, and there is no settings link next
  // to it: the menu then names the user and leads to the settings.
  compact: boolean;
  trigger: ReactNode;
}

const UserMenu = ({ name, compact, trigger }: UserMenuProps) => {
  const navigate = useNavigate();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        {compact && name !== null && (
          <>
            <DropdownMenuLabel>{name}</DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        )}
        {compact && (
          <DropdownMenuItem
            onSelect={() => {
              void navigate(`/${SETTINGS.path}`);
            }}
          >
            <SETTINGS.icon />
            {SETTINGS.label}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onSelect={() => {
            void navigate('/logout');
          }}
        >
          <LogOut />
          Ausloggen
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const UpdateNotice = () => {
  const dispatch = useAppDispatch();

  return (
    <Alert className="mx-auto mb-4 max-w-3xl">
      <RefreshCw />
      <AlertTitle>Aktualisierung verfügbar</AlertTitle>
      <AlertDescription>Bitte die App neu starten.</AlertDescription>
      <AlertAction>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Hinweis schließen"
          onClick={() => dispatch(ignoreUpdate())}
        >
          <X />
        </Button>
      </AlertAction>
    </Alert>
  );
};

interface Props {
  children: ReactNode;
}

// Desktop: a sidebar with all destinations. Phone: a top bar with the user
// menu, which also holds the settings, and a tab bar at the bottom within
// reach of the thumb.
const AppLayout = ({ children }: Props) => {
  const { pathname, search } = useLocation();
  const current = currentDestination(pathname);
  const dashboardTab =
    current === ANALYSIS.path
      ? toDashboardTab(new URLSearchParams(search).get('tab'))
      : null;
  // App only mounts the layout once logged in, but the state type admits null.
  const name = useAppSelector(
    ({ authentication }) => authentication.userInfo?.fullName ?? null
  );
  const updateAvailable = useAppSelector(
    ({ notifications }) =>
      notifications.updateAvailable && !notifications.updateIgnored
  );

  return (
    <div className="min-h-svh">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex h-14 items-center px-4">
          <Brand />
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-2">
          {DESTINATIONS.map(d => (
            <Fragment key={d.path}>
              <SidebarLink destination={d} active={d.path === current} />
              {d === ANALYSIS && <DashboardTabLinks active={dashboardTab} />}
            </Fragment>
          ))}
        </nav>
        <div className="flex flex-col gap-1 border-t p-2">
          <SidebarLink
            destination={SETTINGS}
            active={current === SETTINGS.path}
          />
          <UserMenu
            name={name}
            compact={false}
            trigger={
              <Button
                variant="ghost"
                className="h-9 justify-start gap-3 px-3 font-normal"
              >
                <CircleUser className="size-4" />
                <span className="truncate">{name}</span>
              </Button>
            }
          />
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/90 px-4 backdrop-blur md:hidden">
        <Brand />
        <UserMenu
          name={name}
          compact
          trigger={
            <Button variant="ghost" size="icon-lg" aria-label="Benutzermenü">
              <CircleUser className="size-5" />
            </Button>
          }
        />
      </header>

      {/* The bottom padding on phones keeps the end of a page above the tab
          bar. */}
      <main className="p-3 pb-24 md:ml-60 md:pb-3">
        {updateAvailable && <UpdateNotice />}
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {DESTINATIONS.map(d => (
          <TabBarLink
            key={d.path}
            destination={d}
            active={d.path === current}
          />
        ))}
      </nav>
    </div>
  );
};

export default AppLayout;
