import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import RequireAuth from './components/auth/RequireAuth';
import AuthenticatedShell from './components/auth/AuthenticatedShell';
import Dashboard from './pages/Dashboard';
import AddExpense from './pages/AddExpense';
import Charts from './pages/Charts';
import Settings from './pages/Settings';
import Auth from './pages/Auth';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Auth />} />
          <Route element={<RequireAuth><AuthenticatedShell /></RequireAuth>}>
            <Route index element={<Dashboard />} />
            <Route path="add" element={<AddExpense />} />
            <Route path="charts" element={<Charts />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
