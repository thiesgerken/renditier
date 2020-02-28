import { connect } from 'react-redux';
import React from 'react';
// import PropTypes from 'prop-types';

const Settings = ({ workerRegistered }) => (
  <div>
    Einstellungen
    <div>ServiceWorker: {workerRegistered ? 'Ja' : 'Nein'}</div>
  </div>
);

Settings.propTypes = {};

const mapStateToProps = ({ notifications }) => ({
  workerRegistered: notifications.registration !== null,
});

export default connect(mapStateToProps)(Settings);
