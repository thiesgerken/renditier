import React from 'react';
import { Route, Routes, useParams } from 'react-router-dom';

import LoginPage from './LoginPage';
import AppLayout from './AppLayout';
import {
  isAuthenticated,
  isAuthenticationInitialized,
} from '../selectors/authentication';
import { logout, checkLogin } from '../slices/authentication';
import { navigateTo } from '../navigation';
import Dashboard from './Dashboard';
import Settings from './Settings';
import Transactions from './Transactions';
import Accounts from './Accounts';
import StockTable from './StockTable';
import StockAnalysis from './StockAnalysis';
import { useAppDispatch, useAppSelector } from '../store';

const StockAnalysisRoute = () => {
  const { isin } = useParams();
  // The route pattern below is `/stocks/:isin`, so this component only renders
  // when the segment matched; useParams still widens it to `string | undefined`.
  return <StockAnalysis isin={isin as string} />;
};

const LogoutRoute = () => {
  const dispatch = useAppDispatch();

  React.useEffect(() => {
    // Navigating away first would render the app's pages for a moment after
    // the session ended.
    void dispatch(logout()).then(action => {
      if (logout.fulfilled.match(action)) navigateTo('/');
    });
  }, [dispatch]);

  return null;
};

const App = () => {
  const dispatch = useAppDispatch();
  const loggedIn = useAppSelector(isAuthenticated);
  const initialized = useAppSelector(isAuthenticationInitialized);

  if (!initialized) {
    void dispatch(checkLogin());
    return <></>;
  }

  if (!loggedIn) return <LoginPage />;

  return (
    <AppLayout>
      <Routes>
        <Route path="/logout" element={<LogoutRoute />} />
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

export default App;
