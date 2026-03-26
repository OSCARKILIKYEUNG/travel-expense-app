import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Home, Plus, BarChart, Settings } from '../ui/Icons';

const NAV_KEYS = [
  { to: '/', icon: Home, labelKey: 'nav.dashboard' },
  { to: '/add', icon: Plus, labelKey: 'nav.addRecord' },
  { to: '/charts', icon: BarChart, labelKey: 'nav.charts' },
  { to: '/settings', icon: Settings, labelKey: 'nav.settings' },
];

export default function Sidebar() {
  const { t } = useTranslation();
  return (
    <aside className="hidden lg:flex flex-col w-56 shrink-0 bg-white border-r border-slate-200 p-4 gap-1" role="navigation" aria-label="側邊導航">
      <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-2 px-3">{t('nav.sidebarTitle')}</p>
      {NAV_KEYS.map(({ to, icon: Icon, labelKey }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors
            ${isActive
              ? 'bg-indigo-50 text-indigo-700'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500`
          }
        >
          <Icon size={18} />
          {t(labelKey)}
        </NavLink>
      ))}
    </aside>
  );
}
