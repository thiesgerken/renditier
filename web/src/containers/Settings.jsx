import { connect } from 'react-redux';
import React from 'react';
import * as moment from 'moment';
import 'moment/locale/de';
import PropTypes from 'prop-types';
import FormGroup from '@material-ui/core/FormGroup';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Switch from '@material-ui/core/Switch';

import { subscribe, unsubscribe } from '../actions/notifications';
import { buildCommit, buildDate } from '../git';

const Settings = ({
  workerRegistered,
  pushSubscribed,
  pushSubscribe,
  pushUnsubscribe,
  updateAvailable,
}) => {
  moment.locale('de');

  return (
    <div>
      <div>
        Version #{buildCommit}, gebaut {moment(buildDate).format('LLL')} (
        {moment(buildDate).fromNow()})
      </div>
      {updateAvailable && (
        <div>
          Es ist eine Aktualisierung verfügbar, zum Installieren bitte die App
          neustarten.
        </div>
      )}
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
          label="Push-Benachrichtigungen"
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
  updateAvailable: PropTypes.bool.isRequired,
};

const mapStateToProps = ({ notifications, authentication }) => ({
  workerRegistered:
    notifications.registration !== null &&
    authentication.userInfo !== null &&
    authentication.userInfo.applicationServerKey !== '',
  pushSubscribed: notifications.subscription !== null,
  updateAvailable: notifications.updateAvailable,
});

const mapDispatchToProps = dispatch => ({
  pushSubscribe: () => dispatch(subscribe()),
  pushUnsubscribe: () => dispatch(unsubscribe()),
});

export default connect(mapStateToProps, mapDispatchToProps)(Settings);
