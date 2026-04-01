import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Home, Plus, BarChart, Settings } from '../ui/Icons';

const NAV_KEYS = [
  { to: '/', icon: Home, labelKey: 'nav.home' },
  { to: '/add', icon: Plus, labelKey: 'nav.add' },
  { to: '/charts', icon: BarChart, labelKey: 'nav.charts' },
  { to: '/settings', icon: Settings, labelKey: 'nav.settings' },
];

export default function BottomNav() {
  const { t } = useTranslation();
  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 border-t border-[var(--paper-border)] bg-[rgba(251,247,239,0.94)] lg:hidden safe-bottom backdrop-blur" role="navigation" aria-label="主導航">
      <div className="grid grid-cols-4 max-w-lg mx-auto">
        {NAV_KEYS.map(({ to, icon: Icon, labelKey }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-2 transition-colors
              ${isActive ? 'text-[var(--accent-strong)]' : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'}
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-inset`
            }
          >
            <Icon size={22} />
            <span className="text-[10px] font-medium">{t(labelKey)}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
