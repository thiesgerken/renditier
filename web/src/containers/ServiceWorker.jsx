import { connect } from 'react-redux';
import React from 'react';
import PropTypes from 'prop-types';

import * as serviceWorker from '../serviceWorker';
import {
  updateRegistration as updateRegistrationAction,
  subscribe as subscribeAction,
  updateAvailable as updateAvailableAction,
} from '../actions/notifications';

const ServiceWorker = ({ updateRegistration, subscribe, updateAvailable }) => {
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

ServiceWorker.propTypes = {
  updateRegistration: PropTypes.func.isRequired,
  subscribe: PropTypes.func.isRequired,
  updateAvailable: PropTypes.func.isRequired,
};

const mapDispatchToProps = dispatch => ({
  updateRegistration: registration =>
    dispatch(updateRegistrationAction(registration)),
  subscribe: () => dispatch(subscribeAction()),
  updateAvailable: () => dispatch(updateAvailableAction()),
});

export default connect(null, mapDispatchToProps)(ServiceWorker);
