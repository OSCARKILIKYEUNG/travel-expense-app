import { useAuth } from '../../context/AuthContext';
import { AppProvider } from '../../store/AppContext';
import AppLayout from '../layout/AppLayout';

export default function AuthenticatedShell() {
  const { user } = useAuth();
  if (!user?.id) return null;

  return (
    <AppProvider key={user.id} userId={user.id}>
      <AppLayout />
    </AppProvider>
  );
}
