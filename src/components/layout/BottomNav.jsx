import { NavLink } from 'react-router-dom';
import { Home, Plus, BarChart, Settings } from '../ui/Icons';

const NAV_ITEMS = [
  { to: '/', icon: Home, label: '首頁' },
  { to: '/add', icon: Plus, label: '新增' },
  { to: '/charts', icon: BarChart, label: '圖表' },
  { to: '/settings', icon: Settings, label: '設定' },
];

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200 lg:hidden safe-bottom" role="navigation" aria-label="主導航">
      <div className="grid grid-cols-4 max-w-lg mx-auto">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-2 transition-colors
              ${isActive ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-inset`
            }
          >
            <Icon size={22} />
            <span className="text-[10px] font-medium">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
