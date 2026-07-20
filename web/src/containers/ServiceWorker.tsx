import { connect } from 'react-redux';
import type { ConnectedProps } from 'react-redux';

import * as serviceWorker from '../serviceWorker';
import {
  updateRegistration as updateRegistrationAction,
  subscribe as subscribeAction,
  updateAvailable as updateAvailableAction,
} from '../actions/notifications';
import type { AppDispatch } from '../types/actions';

const ServiceWorker = ({
  updateRegistration,
  subscribe,
  updateAvailable,
}: Props) => {
  serviceWorker.register({
    onInit: registration => {
      updateRegistration(registration);

      // Set the initial subscription value
      registration.pushManager.getSubscription().then(() => {
        subscribe();
      });
    },
    onUpdate: () => {
      updateAvailable();
    },
  });

  return <></>;
};

const mapDispatchToProps = (dispatch: AppDispatch) => ({
  updateRegistration: (registration: ServiceWorkerRegistration) =>
    dispatch(updateRegistrationAction(registration)),
  subscribe: () => dispatch(subscribeAction()),
  updateAvailable: () => dispatch(updateAvailableAction()),
});

const connector = connect(null, mapDispatchToProps);

type Props = ConnectedProps<typeof connector>;

export default connector(ServiceWorker);
