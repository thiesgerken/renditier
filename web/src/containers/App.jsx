import React from 'react';
import { Switch, Route } from 'react-router-dom';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';

import LoginPage from './LoginPage';
import AppLayout from './AppLayout';
import {
  isAuthenticated,
  isAuthenticationInitialized,
} from '../selectors/authentication';
import { logout, checkLogin } from '../actions/authentication';
import Dashboard from './Dashboard';
import Settings from './Settings';
import Transactions from './Transactions';
import Accounts from './Accounts';

const App = ({ loggedIn, onLogout, initialized, onInitAuthentication }) => {
  if (!initialized) {
    onInitAuthentication();
    return <></>;
  }

  if (!loggedIn) return <LoginPage />;

  return (
    <AppLayout>
      <Switch>
        <Route exact path="/logout" render={onLogout} />
        <Route exact path="/accounts" render={() => <Accounts />} />
        <Route exact path="/transactions" render={() => <Transactions />} />
        <Route exact path="/settings" render={() => <Settings />} />
        <Route render={() => <Dashboard />} />
      </Switch>
    </AppLayout>
  );
};

App.propTypes = {
  loggedIn: PropTypes.bool.isRequired,
  initialized: PropTypes.bool.isRequired,
  onLogout: PropTypes.func.isRequired,
  onInitAuthentication: PropTypes.func.isRequired,
};

const mapStateToProps = state => {
  return {
    loggedIn: isAuthenticated(state),
    initialized: isAuthenticationInitialized(state),
  };
};

const mapDispatchToProps = dispatch => {
  return {
    onLogout: () => {
      dispatch(logout());
    },
    onInitAuthentication: () => dispatch(checkLogin()),
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(App);
