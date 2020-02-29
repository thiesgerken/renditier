import { connect } from 'react-redux';
import React from 'react';
import PropTypes from 'prop-types';
import FormGroup from '@material-ui/core/FormGroup';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Switch from '@material-ui/core/Switch';
import { subscribe, unsubscribe } from '../actions/notifications';

const Settings = ({
  workerRegistered,
  pushSubscribed,
  pushSubscribe,
  pushUnsubscribe,
}) => {
  return (
    <div>
      <div>ServiceWorker: {workerRegistered ? 'Ja' : 'Nein'}</div>

      <FormGroup row>
        <FormControlLabel
          control={
            <Switch
              checked={pushSubscribed}
              onChange={e =>
                e.target.checked ? pushSubscribe() : pushUnsubscribe()
              }
              disabled={!workerRegistered}
            />
          }
          label="Secondary"
        />
      </FormGroup>
    </div>
  );
};

Settings.propTypes = {
  workerRegistered: PropTypes.bool.isRequired,
  pushSubscribed: PropTypes.bool.isRequired,
  pushSubscribe: PropTypes.func.isRequired,
  pushUnsubscribe: PropTypes.func.isRequired,
};

const mapStateToProps = ({ notifications }) => ({
  workerRegistered: notifications.registration !== null,
  pushSubscribed: notifications.subscription !== null,
});

const mapDispatchToProps = dispatch => ({
  pushSubscribe: () => dispatch(subscribe()),
  pushUnsubscribe: () => dispatch(unsubscribe()),
});

export default connect(mapStateToProps, mapDispatchToProps)(Settings);
