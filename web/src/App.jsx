import React from 'react';
import { Switch, Route, Link } from 'react-router-dom';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import { push } from 'connected-react-router';

import LoginPage from './containers/LoginPage';
import {
  isAuthenticated,
  isAuthenticationInitialized,
} from './selectors/authentication';
import { logout, checkLogin } from './actions/authentication';
import Dashboard from './containers/Dashboard';

const App = ({ loggedIn, onLogout, initialized, onInitAuthentication }) => {
  if (!initialized) {
    onInitAuthentication();
    return <></>;
  }

  if (!loggedIn) return <LoginPage />;

  return (
    <Switch>
      <Route exact path="/logout" render={onLogout} />
      <Route
        render={() => (
          <>
            <Link to="/logout">Logout</Link>
            <Dashboard />
          </>
        )}
      />
    </Switch>
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
      // TODO: instead of redirecting, display a message (=> introduce Logout component?)
      dispatch(logout()).then(() => dispatch(push('/')));
    },
    onInitAuthentication: () => dispatch(checkLogin()),
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(App);
