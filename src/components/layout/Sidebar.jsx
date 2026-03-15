import { NavLink } from 'react-router-dom';
import { Home, Plus, BarChart, Settings } from '../ui/Icons';

const NAV_ITEMS = [
  { to: '/', icon: Home, label: '儀表板' },
  { to: '/add', icon: Plus, label: '新增記錄' },
  { to: '/charts', icon: BarChart, label: '統計圖表' },
  { to: '/settings', icon: Settings, label: '設定' },
];

export default function Sidebar() {
  return (
    <aside className="hidden lg:flex flex-col w-56 shrink-0 bg-white border-r border-slate-200 p-4 gap-1" role="navigation" aria-label="側邊導航">
      <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-2 px-3">導航</p>
      {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
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
          {label}
        </NavLink>
      ))}
    </aside>
  );
}
