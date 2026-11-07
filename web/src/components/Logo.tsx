import { cn } from 'cn';

// The reindeer from docs/brand/logo/renditier-mark.svg: a natural antler on the
// left, a price line breaking out to a new high on the right. The eyes are
// holes, so the mark takes the colour of whatever it sits on.
const Mark = ({ className }: { className?: string }) => (
  <svg viewBox="1.5 4 61 61" aria-hidden="true" className={className}>
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth={5.2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M26 34Q22.5 32 20 28.5C17.4 24.8 15.6 20.8 15 14.5 M19.2 27.4L7.5 21.6" />
      <path d="M38 34Q41 31.5 43 27.5L46 21.5L49.5 25L57 10.5" />
    </g>
    <circle cx={57} cy={10.5} r={3.4} className="fill-brand" />
    <path
      fill="currentColor"
      d="M19.5 39.5C16 39 12.5 40.5 10.5 43.5C14 44.5 17.5 44 20 42.5Z M44.5 39.5C48 39 51.5 40.5 53.5 43.5C50 44.5 46.5 44 44 42.5Z"
    />
    <path
      fill="currentColor"
      fillRule="evenodd"
      d="M19 37.5Q20.5 33.6 26 33L38 33Q43.5 33.6 45 37.5C45.5 46 42.5 54 38.5 58.5C36 61.5 28 61.5 25.5 58.5C21.5 54 18.5 46 19 37.5Z M24.87 43.6a1.53 1.53 0 1 0 3.06 0a1.53 1.53 0 1 0 -3.06 0Z M36.07 43.6a1.53 1.53 0 1 0 3.06 0a1.53 1.53 0 1 0 -3.06 0Z"
    />
  </svg>
);

// Mark plus wordmark, sized by the font size it is given: the mark is 1.55em
// tall, as in the lockup files.
export const Lockup = ({ className }: { className?: string }) => (
  <span
    role="img"
    aria-label="Renditier"
    className={cn(
      'inline-flex items-center gap-[0.18em] font-brand font-bold tracking-[-0.01em]',
      className
    )}
  >
    <Mark className="size-[1.55em] shrink-0" />
    <span aria-hidden="true">
      Rendi<span className="text-brand">tier</span>
    </span>
  </span>
);
