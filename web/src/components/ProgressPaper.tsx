import type { CSSProperties, ReactNode } from 'react';
import { CircularProgress, Paper } from '@mui/material';

interface Props {
  loading: boolean;
  children: ReactNode;
  style?: CSSProperties;
}

const ProgressPaper = ({ loading, children, style = {} }: Props) => (
  <Paper style={{ ...style, minHeight: '8em' }}>
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      {loading && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(0%, -0%)',
            width: '0%',
            height: '0%',
            padding: '0px',
            margin: 0,
            zIndex: 9,
          }}
        >
          <CircularProgress color="secondary" />
        </div>
      )}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          left: '0',
          top: '0',
        }}
      >
        {children}
      </div>
    </div>
  </Paper>
);

export default ProgressPaper;
