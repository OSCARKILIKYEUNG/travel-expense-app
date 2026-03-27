import { Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';

export default function RequireAuth({ children }) {
  const { t } = useTranslation();
  const { user, loading, supabaseConfigured } = useAuth();
  const location = useLocation();

  if (!supabaseConfigured) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <p className="text-slate-600 text-sm">{t('auth.loading')}</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}
