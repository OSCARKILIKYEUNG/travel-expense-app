import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Home, Plus, BarChart, Settings } from '../ui/Icons';

/** 四主項：首頁／新增／圖表／設定（與 BottomNav 一致） */
const NAV_KEYS = [
  { to: '/', icon: Home, labelKey: 'nav.home' },
  { to: '/add', icon: Plus, labelKey: 'nav.addRecord' },
  { to: '/charts', icon: BarChart, labelKey: 'nav.charts' },
  { to: '/settings', icon: Settings, labelKey: 'nav.settings' },
];

export default function Sidebar() {
  const { t } = useTranslation();
  return (
    <aside className="hidden lg:flex flex-col w-60 shrink-0 border-r border-[var(--paper-border)] p-4 gap-1 bg-[rgba(251,247,239,0.55)]" role="navigation" aria-label="側邊導航">
      <p className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--ink-muted)] font-semibold mb-2 px-3">{t('nav.sidebarTitle')}</p>
      {NAV_KEYS.map(({ to, icon: Icon, labelKey }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-medium transition-colors
            ${isActive
              ? 'bg-[var(--accent-soft)] text-[var(--accent-strong)]'
              : 'text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-white/50'}
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]`
          }
        >
          <Icon size={18} />
          {t(labelKey)}
        </NavLink>
      ))}
    </aside>
  );
}
