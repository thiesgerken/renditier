import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { MouseEvent, RefObject, TouchEvent } from 'react';
import { RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  usePlotArea,
  useXAxisInverseDataSnapScale,
  useXAxisScale,
} from 'recharts';
import type { InverseScaleFunction } from 'recharts';

import { Button } from '../ui/button';
import type { DateRange } from './PlotControls';

type Inverse = InverseScaleFunction | undefined;

// Hands the chart's x scale, which only exists inside the chart, to the
// zoom's event handlers outside of it.
const ScaleProbe = ({ scaleRef }: { scaleRef: RefObject<Inverse> }) => {
  const inverse = useXAxisInverseDataSnapScale();
  useEffect(() => {
    scaleRef.current = inverse;
  }, [scaleRef, inverse]);
  return null;
};

type Drag = [number, number] | null;

// The epochs of the points where the drag started and where it is now. A
// store outside React state, so that a move re-renders only the selection
// below, not the plot with its thousands of points.
const createDragStore = () => {
  let drag: Drag = null;
  const listeners = new Set<() => void>();
  return {
    get: () => drag,
    set: (next: Drag) => {
      drag = next;
      listeners.forEach(listener => {
        listener();
      });
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
};

type DragStore = ReturnType<typeof createDragStore>;

// The selected span over the whole height of the plot.
const Selection = ({ store }: { store: DragStore }) => {
  const drag = useSyncExternalStore(store.subscribe, store.get);
  const scale = useXAxisScale();
  const area = usePlotArea();
  if (drag === null || scale === undefined || area === undefined) return null;

  const [from, to] = drag.map(epoch => scale(epoch));
  if (from === undefined || to === undefined) return null;

  return (
    <rect
      x={Math.min(from, to)}
      y={area.y}
      width={Math.abs(to - from)}
      height={area.height}
      fill="var(--primary)"
      fillOpacity={0.15}
      pointerEvents="none"
    />
  );
};

const dayOf = (epoch: number) =>
  Temporal.Instant.fromEpochMilliseconds(epoch)
    .toZonedDateTimeISO(Temporal.Now.timeZoneId())
    .toPlainDate();

type ChartEvent =
  MouseEvent<SVGGraphicsElement> | TouchEvent<SVGGraphicsElement>;

const clientX = (event: ChartEvent) => {
  if (!('touches' in event)) return event.clientX;

  // A lifted finger is no longer in `touches`, only in `changedTouches`.
  const touch = event.touches[0] ?? event.changedTouches[0];
  if (touch === undefined) throw new Error('touch event without a touch');
  return touch.clientX;
};

// Dragging across a chart, with the mouse or a finger, selects the days to
// zoom into. The plots fetch whole days, so a zoom is a custom date range:
// it gets points at the resolution of the narrower range and a rescaled y
// axis, which merely clipping the x axis would not.
//
// `snapshot` is the plot's state that a zoom changes. The state from before
// the first zoom is kept, so that `reset` can bring it back; `forget` drops it
// when the plot moves on by other means, e.g. another period.
export const useDragZoom = <S,>({
  snapshot,
  zoomTo,
  restore,
}: {
  snapshot: S;
  zoomTo: (range: DateRange) => void;
  restore: (before: S) => void;
}) => {
  const [before, setBefore] = useState<{ state: S } | null>(null);
  const scaleRef = useRef<Inverse>(undefined);
  const [store] = useState(createDragStore);

  // Recharts' own active point only follows the mouse, not a finger, so the
  // position comes from the event.
  const epochAt = (event: ChartEvent) => {
    const left = event.currentTarget.getBoundingClientRect().left;
    const epoch = scaleRef.current?.(clientX(event) - left);
    return typeof epoch === 'number' ? epoch : undefined;
  };

  const start = (_: unknown, event: ChartEvent) => {
    const epoch = epochAt(event);
    if (epoch !== undefined) store.set([epoch, epoch]);
  };

  const move = (_: unknown, event: ChartEvent) => {
    const from = store.get()?.[0];
    const epoch = epochAt(event);
    if (from !== undefined && epoch !== undefined) store.set([from, epoch]);
  };

  // a click without a drag is no zoom
  const end = () => {
    const selected = store.get();
    store.set(null);
    if (selected !== null && selected[0] !== selected[1]) {
      if (before === null) setBefore({ state: snapshot });
      zoomTo([dayOf(Math.min(...selected)), dayOf(Math.max(...selected))]);
    }
  };

  return {
    reset:
      before === null
        ? null
        : () => {
            restore(before.state);
            setBefore(null);
          },
    forget: () => setBefore(null),
    chartProps: {
      onMouseDown: start,
      onMouseMove: move,
      onMouseUp: end,
      onMouseLeave: () => {
        store.set(null);
      },
      onTouchStart: start,
      onTouchMove: move,
      onTouchEnd: end,
      // a vertical swipe still scrolls the page, a horizontal one selects
      style: { touchAction: 'pan-y', userSelect: 'none' } as const,
    },
    // direct children of the chart, which recharts only renders as such
    elements: [
      <ScaleProbe key="zoomScale" scaleRef={scaleRef} />,
      <Selection key="zoomSelection" store={store} />,
    ],
  };
};

export const ZoomReset = ({ onClick }: { onClick: () => void }) => {
  const { t } = useTranslation();

  return (
    <Button variant="outline" size="sm" onClick={onClick}>
      <RotateCcw />
      {t('plot.reset')}
    </Button>
  );
};
