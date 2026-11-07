import { useEffect, useEffectEvent, useRef } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import {
  DASHBOARD_TAB_ICONS,
  DASHBOARD_TABS,
  DEFAULT_TAB,
} from './dashboardTabs';
import type { DashboardTab } from './dashboardTabs';

// Below the sticky period bar: where a section heading lands after scrolling
// to it, and so where the scroll spy takes it as current.
const SPY_OFFSET_PX = 80;

const smoothly = (): ScrollBehavior =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ? 'instant'
    : 'smooth';

interface Props {
  sections: Record<DashboardTab, ReactNode>;
  tab: DashboardTab;
  onScrollTo: (tab: DashboardTab) => void;
  // Once the content above a section has its height, so that scrolling to it
  // stays there.
  ready: boolean;
}

// The desktop dashboard: every tab as a section of one page. A `tab` coming in
// from a link, a reload or the sidebar scrolls to its section; scrolling
// reports the section in view through `onScrollTo`, which puts it into the URL.
const DashboardSections = ({ sections, tab, onScrollTo, ready }: Props) => {
  const { t } = useTranslation();
  const elements = useRef(new Map<DashboardTab, HTMLElement>());
  // The tab last scrolled to or reported, so that a `tab` the spy reported
  // itself does not scroll again.
  const shown = useRef<DashboardTab | null>(null);
  // While a sidebar click glides to its section, the spy waits for the end:
  // reporting the sections passed on the way would turn the URL back to them
  // and stop the glide.
  const gliding = useRef(false);
  const report = useEffectEvent((current: DashboardTab) => onScrollTo(current));

  useEffect(() => {
    if (!ready || tab === shown.current) return;

    // Arriving by a link or a reload jumps; a click in the sidebar glides.
    const behavior = shown.current === null ? 'instant' : smoothly();
    shown.current = tab;
    // The first section is the top of the page, KPIs included.
    const element = tab === DEFAULT_TAB ? undefined : elements.current.get(tab);
    const wanted =
      element === undefined
        ? 0
        : window.scrollY + element.getBoundingClientRect().top - SPY_OFFSET_PX;
    // Near the end of the page the window may not get that far.
    const bottom = document.documentElement.scrollHeight - window.innerHeight;
    const top = Math.min(Math.max(wanted, 0), bottom);
    // Without a distance to go, there is no scrollend to end the glide.
    gliding.current =
      behavior === 'smooth' && Math.abs(top - window.scrollY) > 1;
    window.scrollTo({ top, behavior });
  }, [tab, ready]);

  useEffect(() => {
    if (!ready) return undefined;

    let frame = 0;
    const spy = () => {
      if (gliding.current) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const current =
          [...elements.current].findLast(
            ([, element]) =>
              element.getBoundingClientRect().top <= SPY_OFFSET_PX + 1
          )?.[0] ?? DEFAULT_TAB;

        if (current !== shown.current) {
          shown.current = current;
          report(current);
        }
      });
    };

    const glided = () => {
      gliding.current = false;
      spy();
    };

    window.addEventListener('scroll', spy, { passive: true });
    window.addEventListener('scrollend', glided);
    return () => {
      window.removeEventListener('scroll', spy);
      window.removeEventListener('scrollend', glided);
      cancelAnimationFrame(frame);
    };
  }, [ready]);

  return (
    <div className="flex flex-col gap-8">
      {DASHBOARD_TABS.map(section => {
        const Icon = DASHBOARD_TAB_ICONS[section];

        return (
          <section
            key={section}
            ref={element => {
              if (element === null) elements.current.delete(section);
              else elements.current.set(section, element);
            }}
            aria-labelledby={`section-${section}`}
            // The last section fills the screen below the period bar, so
            // that every section can scroll up to it and become current.
            className="flex flex-col gap-3 last:min-h-[calc(100svh-5rem)]"
          >
            <h2
              id={`section-${section}`}
              className="flex items-center gap-2 text-base font-semibold"
            >
              <Icon className="size-4 text-muted-foreground" />
              {t(`dashboard.tabs.${section}`)}
            </h2>
            {sections[section]}
          </section>
        );
      })}
    </div>
  );
};

export default DashboardSections;
