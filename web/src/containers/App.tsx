import React from 'react';
import { Route, Routes, useParams } from 'react-router-dom';
import { connect } from 'react-redux';
import type { ConnectedProps } from 'react-redux';

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
import type { AppDispatch } from '../types/actions';
import type { RootState } from '../types/store';

const StockAnalysisRoute = () => {
  const { isin } = useParams();
  // The route pattern below is `/stocks/:isin`, so this component only renders
  // when the segment matched; useParams still widens it to `string | undefined`.
  return <StockAnalysis isin={isin as string} />;
};

interface LogoutRouteProps {
  onLogout: () => void;
}

const LogoutRoute = ({ onLogout }: LogoutRouteProps) => {
  React.useEffect(() => {
    onLogout();
  }, [onLogout]);

  return null;
};

const App = ({
  loggedIn,
  onLogout,
  initialized,
  onInitAuthentication,
}: Props) => {
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

const mapStateToProps = (state: RootState) => ({
  loggedIn: isAuthenticated(state),
  initialized: isAuthenticationInitialized(state),
});

const mapDispatchToProps = (dispatch: AppDispatch) => ({
  onLogout: () => {
    dispatch(logout());
  },
  onInitAuthentication: () => dispatch(checkLogin()),
});

const connector = connect(mapStateToProps, mapDispatchToProps);

type Props = ConnectedProps<typeof connector>;

export default connector(App);
