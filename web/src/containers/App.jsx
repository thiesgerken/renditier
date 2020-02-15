import React from 'react';
import { Switch, Route, Link } from 'react-router-dom';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import { push } from 'connected-react-router';
import { Link as MUILink } from '@material-ui/core';

import LoginPage from './LoginPage';
import AppLayout from '../components/AppLayout';
import {
  isAuthenticated,
  isAuthenticationInitialized,
} from '../selectors/authentication';
import { logout, checkLogin } from '../actions/authentication';
import Dashboard from './Dashboard';

const App = ({ loggedIn, onLogout, initialized, onInitAuthentication }) => {
  if (!initialized) {
    onInitAuthentication();
    return <></>;
  }

  if (!loggedIn) return <LoginPage />;

  return (
    // <AppLayout>
    <Switch>
      <Route exact path="/logout" render={onLogout} />
      <Route
        render={() => (
          <>
            <MUILink to="/logout" component={Link}>
              Logout
            </MUILink>
            <Dashboard />
          </>
        )}
      />
    </Switch>
    // </AppLayout>
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
      dispatch(logout()).then(() => dispatch(push('/')));
    },
    onInitAuthentication: () => dispatch(checkLogin()),
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(App);
