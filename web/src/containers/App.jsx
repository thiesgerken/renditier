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
import StockTable from './StockTable';
import StockAnalysis from './StockAnalysis';

const App = ({ loggedIn, onLogout, initialized, onInitAuthentication }) => {
  if (!initialized) {
    onInitAuthentication();
    return <></>;
  }

  if (!loggedIn) return <LoginPage />;

  return (
    <AppLayout>
      <Switch>
        <Route path="/logout" render={onLogout} />
        <Route
          path="/stocks/:isin"
          render={e => <StockAnalysis isin={e.match.params.isin} />}
        />
        <Route path="/stocks" render={() => <StockTable />} />
        <Route path="/accounts" render={() => <Accounts />} />
        <Route path="/transactions" render={() => <Transactions />} />
        <Route path="/settings" render={() => <Settings />} />
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

const mapStateToProps = state => ({
  loggedIn: isAuthenticated(state),
  initialized: isAuthenticationInitialized(state),
});

const mapDispatchToProps = dispatch => ({
  onLogout: () => {
    dispatch(logout());
  },
  onInitAuthentication: () => dispatch(checkLogin()),
});

export default connect(mapStateToProps, mapDispatchToProps)(App);
