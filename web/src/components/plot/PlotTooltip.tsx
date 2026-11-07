export interface TooltipRow {
  label: string;
  value: string;
  color?: string;
}

interface Props {
  title: string;
  rows: TooltipRow[];
}

const PlotTooltip = ({ title, rows }: Props) => (
  <div className="rounded-lg bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10">
    <div className="mb-1 font-medium">{title}</div>
    <div className="grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5">
      {rows.map(({ label, value, color }) => (
        <div key={label} className="contents" style={{ color }}>
          <span>{label}</span>
          <span className="text-right font-normal tabular-nums">{value}</span>
        </div>
      ))}
    </div>
  </div>
);

export default PlotTooltip;
