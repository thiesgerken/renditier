import React from 'react';
import { Route, Routes, useParams } from 'react-router-dom';
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

const StockAnalysisRoute = () => {
  const { isin } = useParams();
  return <StockAnalysis isin={isin} />;
};

const LogoutRoute = ({ onLogout }) => {
  React.useEffect(() => {
    onLogout();
  }, [onLogout]);

  return null;
};

LogoutRoute.propTypes = {
  onLogout: PropTypes.func.isRequired,
};

const App = ({ loggedIn, onLogout, initialized, onInitAuthentication }) => {
  if (!initialized) {
    onInitAuthentication();
    return <></>;
  }

  if (!loggedIn) return <LoginPage />;

  return (
    <AppLayout>
      <Routes>
        <Route path="/logout" element={<LogoutRoute onLogout={onLogout} />} />
        <Route path="/stocks/:isin" element={<StockAnalysisRoute />} />
        <Route path="/stocks" element={<StockTable />} />
        <Route path="/accounts" element={<Accounts />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Dashboard />} />
      </Routes>
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
