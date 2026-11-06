import { connect } from 'react-redux';
import type { ConnectedProps } from 'react-redux';
import React from 'react';
import moment from 'moment';
import FormGroup from '@mui/material/FormGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';

import { subscribe, unsubscribe } from '../actions/notifications';
import { buildCommit, buildDate } from '../git';
import { formatDateTime } from '../format';
import type { AppDispatch } from '../types/actions';
import type { RootState } from '../types/store';

const Settings = ({
  workerRegistered,
  pushSubscribed,
  pushSubscribe,
  pushUnsubscribe,
  updateAvailable,
}: Props) => {
  return (
    <div>
      <div>
        Version #{buildCommit}, gebaut {formatDateTime(buildDate)} (
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
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
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

const mapStateToProps = ({ notifications, authentication }: RootState) => ({
  workerRegistered:
    notifications.registration !== null &&
    authentication.userInfo !== null &&
    authentication.userInfo.applicationServerKey !== '',
  pushSubscribed: notifications.subscription !== null,
  updateAvailable: notifications.updateAvailable,
});

const mapDispatchToProps = (dispatch: AppDispatch) => ({
  pushSubscribe: () => dispatch(subscribe()),
  pushUnsubscribe: () => dispatch(unsubscribe()),
});

const connector = connect(mapStateToProps, mapDispatchToProps);

type Props = ConnectedProps<typeof connector>;

export default connector(Settings);
