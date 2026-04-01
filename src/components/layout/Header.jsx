import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useApp } from '../../store/AppContext';
import { MapPin, Globe, ChevronDown } from '../ui/Icons';

export default function Header() {
  const { t } = useTranslation();
  const { currentTrip, trips, switchTrip } = useApp();

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--paper-border)] bg-[rgba(251,247,239,0.9)] backdrop-blur">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] rounded-2xl px-2 py-1">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
            <MapPin size={18} />
          </div>
          <div className="leading-none">
            <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--ink-muted)]">Travel notebook</p>
            <span className="font-semibold text-base tracking-[-0.03em] text-[color:var(--ink)]">{t('app.brand')}</span>
          </div>
        </Link>

        {currentTrip && (
          <div className="relative group">
            <button className="flex items-center gap-1.5 text-xs text-[color:var(--ink-soft)] hover:text-[color:var(--ink)] transition-colors px-3 py-2 rounded-2xl hover:bg-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]">
              <Globe size={14} />
              <span className="max-w-[140px] truncate">{currentTrip.name}</span>
              {trips.length > 1 && <ChevronDown size={14} />}
            </button>

            {trips.length > 1 && (
              <div className="absolute right-0 top-full mt-2 bg-[var(--paper-soft)] text-[var(--ink)] rounded-[24px] shadow-xl border border-[var(--paper-border)] py-2 min-w-[220px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-40">
                {trips.map((trip) => (
                  <button
                    key={trip.id}
                    onClick={() => switchTrip(trip.id)}
                    className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center justify-between hover:bg-white/50
                      ${trip.id === currentTrip.id ? 'text-[var(--accent-strong)] font-semibold bg-[var(--accent-soft)]' : ''}`}
                  >
                    <span className="truncate">{trip.name}</span>
                    {trip.id === currentTrip.id && (
                      <span className="text-[10px] bg-[var(--accent-soft)] text-[var(--accent-strong)] px-1.5 py-0.5 rounded-full ml-2 shrink-0">
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
