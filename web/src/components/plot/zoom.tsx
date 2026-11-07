import { useEffect, useRef, useState } from 'react';
import type { MouseEvent, RefObject, TouchEvent } from 'react';
import { RotateCcw } from 'lucide-react';
import { ReferenceArea, useXAxisInverseDataSnapScale } from 'recharts';
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

const dayOf = (epoch: number) =>
  Temporal.Instant.fromEpochMilliseconds(epoch)
    .toZonedDateTimeISO(Temporal.Now.timeZoneId())
    .toPlainDate();

type ChartEvent =
  MouseEvent<SVGGraphicsElement> | TouchEvent<SVGGraphicsElement>;

const clientX = (event: ChartEvent) =>
  'touches' in event
    ? (event.touches[0] ?? event.changedTouches[0]).clientX
    : event.clientX;

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
  // The epochs of the points where the drag started and where it is now. The
  // ref is what the handlers read, since events can arrive faster than React
  // renders; the state draws the selection.
  const dragRef = useRef<[number, number] | null>(null);
  const [drag, setDrag] = useState<[number, number] | null>(null);
  const update = (next: [number, number] | null) => {
    dragRef.current = next;
    setDrag(next);
  };

  // Recharts' own active point only follows the mouse, not a finger, so the
  // position comes from the event.
  const epochAt = (event: ChartEvent) => {
    const left = event.currentTarget.getBoundingClientRect().left;
    const epoch = scaleRef.current?.(clientX(event) - left);
    return typeof epoch === 'number' ? epoch : undefined;
  };

  const start = (_: unknown, event: ChartEvent) => {
    const epoch = epochAt(event);
    if (epoch !== undefined) update([epoch, epoch]);
  };

  const move = (_: unknown, event: ChartEvent) => {
    const from = dragRef.current?.[0];
    const epoch = epochAt(event);
    if (from !== undefined && epoch !== undefined) update([from, epoch]);
  };

  // a click without a drag is no zoom
  const end = () => {
    const selected = dragRef.current;
    update(null);
    if (selected !== null && selected[0] !== selected[1]) {
      const [from, to] = [...selected].sort((a, b) => a - b);
      if (before === null) setBefore({ state: snapshot });
      zoomTo([dayOf(from), dayOf(to)]);
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
      onMouseLeave: () => update(null),
      onTouchStart: start,
      onTouchMove: move,
      onTouchEnd: end,
      // a vertical swipe still scrolls the page, a horizontal one selects
      style: { touchAction: 'pan-y', userSelect: 'none' } as const,
    },
    // direct children of the chart, which recharts only renders as such
    elements: [
      <ScaleProbe key="zoomScale" scaleRef={scaleRef} />,
      drag === null ? null : (
        <ReferenceArea
          key="zoomSelection"
          x1={drag[0]}
          x2={drag[1]}
          fill="var(--primary)"
          fillOpacity={0.15}
          ifOverflow="hidden"
        />
      ),
    ],
  };
};

export const ZoomReset = ({ onClick }: { onClick: () => void }) => (
  <Button variant="outline" size="sm" onClick={onClick}>
    <RotateCcw />
    Zurücksetzen
  </Button>
);
