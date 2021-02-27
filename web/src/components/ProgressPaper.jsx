import React from 'react';
import PropTypes from 'prop-types';
import { CircularProgress, Paper } from '@material-ui/core';

const ProgressPaper = ({ loading, children, style }) => (
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

ProgressPaper.propTypes = {
  loading: PropTypes.bool.isRequired,
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.node),
    PropTypes.node,
  ]).isRequired,
  style: PropTypes.shape({}),
};

ProgressPaper.defaultProps = {
  style: {},
};

export default ProgressPaper;
