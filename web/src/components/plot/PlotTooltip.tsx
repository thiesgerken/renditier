import { Paper, Typography } from '@mui/material';

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
  <Paper elevation={3} sx={{ px: 1.5, py: 1 }}>
    <Typography variant="subtitle2" gutterBottom>
      {title}
    </Typography>
    <table style={{ borderSpacing: '12px 2px', margin: '0 -12px' }}>
      <tbody>
        {rows.map(({ label, value, color }) => (
          <tr key={label} style={{ color }}>
            <td>{label}</td>
            <td
              style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
            >
              {value}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </Paper>
);

export default PlotTooltip;
