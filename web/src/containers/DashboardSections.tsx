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
// to it (`scroll-mt-20`), and so where the scroll spy takes it as current.
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
  const report = useEffectEvent((current: DashboardTab) => onScrollTo(current));

  useEffect(() => {
    if (!ready || tab === shown.current) return;

    // Arriving by a link or a reload jumps; a click in the sidebar glides.
    const behavior = shown.current === null ? 'instant' : smoothly();
    shown.current = tab;
    // The first section is the top of the page, KPIs included.
    if (tab === DEFAULT_TAB) window.scrollTo({ top: 0, behavior });
    else elements.current.get(tab)?.scrollIntoView({ behavior });
  }, [tab, ready]);

  useEffect(() => {
    if (!ready) return undefined;

    let frame = 0;
    const spy = () => {
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

    window.addEventListener('scroll', spy, { passive: true });
    return () => {
      window.removeEventListener('scroll', spy);
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
            className="flex scroll-mt-20 flex-col gap-3 last:min-h-[calc(100svh-5rem)]"
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
