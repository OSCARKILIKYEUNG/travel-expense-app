import { isClassicUi } from '../../config/features';
import { useAuth } from '../../context/AuthContext';
import NotebookShell from '../../notebook/NotebookShell';
import { AppProvider } from '../../store/AppContext';
import AppLayout from '../layout/AppLayout';

export default function AuthenticatedShell() {
  const { user } = useAuth();
  if (!user?.id) return null;

  const classic = isClassicUi();

  return (
    <AppProvider key={user.id} userId={user.id}>
      {classic ? <AppLayout /> : <NotebookShell />}
    </AppProvider>
  );
}
