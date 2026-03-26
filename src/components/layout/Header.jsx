import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useApp } from '../../store/AppContext';
import { MapPin, Globe, ChevronDown } from '../ui/Icons';

export default function Header() {
  const { t } = useTranslation();
  const { currentTrip, trips, switchTrip } = useApp();

  return (
    <header className="bg-slate-800 text-white sticky top-0 z-30 shadow-lg">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 rounded-lg px-1">
          <MapPin size={18} className="text-pink-400" />
          <span className="font-bold text-base tracking-tight">{t('app.brand')}</span>
        </Link>

        {currentTrip && (
          <div className="relative group">
            <button className="flex items-center gap-1.5 text-xs text-indigo-300 hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50">
              <Globe size={14} />
              <span className="max-w-[140px] truncate">{currentTrip.name}</span>
              {trips.length > 1 && <ChevronDown size={14} />}
            </button>

            {trips.length > 1 && (
              <div className="absolute right-0 top-full mt-1 bg-white text-slate-800 rounded-xl shadow-xl border border-slate-200 py-1 min-w-[200px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-40">
                {trips.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => switchTrip(t.id)}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 transition-colors flex items-center justify-between
                      ${t.id === currentTrip.id ? 'text-indigo-600 font-semibold bg-indigo-50/50' : ''}`}
                  >
                    <span className="truncate">{t.name}</span>
                    {t.id === currentTrip.id && (
                      <span className="text-[10px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full ml-2 shrink-0">
                        {t('trip.current')}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
