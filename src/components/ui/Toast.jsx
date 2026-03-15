import { useApp } from '../../store/AppContext';
import { Check, AlertCircle, X } from './Icons';

const STYLES = {
  success: 'bg-emerald-600 text-white',
  error: 'bg-red-600 text-white',
  warning: 'bg-amber-500 text-white',
  info: 'bg-indigo-600 text-white',
};

const ICONS = {
  success: Check,
  error: AlertCircle,
  warning: AlertCircle,
  info: AlertCircle,
};

export default function Toast() {
  const { toast } = useApp();
  if (!toast) return null;

  const Icon = ICONS[toast.type] || Check;

  return (
    <div
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-xl shadow-lg
        flex items-center gap-2 animate-slide-up ${STYLES[toast.type] || STYLES.success}`}
      role="status"
      aria-live="polite"
    >
      <Icon size={18} />
      <span className="text-sm font-medium">{toast.message}</span>
    </div>
  );
}
