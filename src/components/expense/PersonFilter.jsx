import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../../store/AppContext';

export default function PersonFilter() {
  const { t } = useTranslation();
  const { expenses, people, filterPerson, setFilterPerson } = useApp();

  const counts = useMemo(() => {
    const map = {};
    for (const person of people) {
      map[person] = expenses.filter((e) => {
        if ((e.assignedTo || '共同') === person) return true;
        return e.items?.some((i) => (i.assignedTo || e.assignedTo || '共同') === person);
      }).length;
    }
    return map;
  }, [expenses, people]);

  if (expenses.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mb-4" role="radiogroup" aria-label={t('filter.label')}>
      <span className="text-xs text-slate-500 font-medium self-center">{t('filter.label')}</span>
      <button
        onClick={() => setFilterPerson(null)}
        role="radio"
        aria-checked={filterPerson === null}
        className={`px-3 py-1 rounded-full text-xs font-medium transition-all
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400
          ${filterPerson === null ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
      >
        {t('filter.all', { count: expenses.length })}
      </button>
      {people.map((person) => {
        const c = counts[person] || 0;
        if (c === 0) return null;
        return (
          <button
            key={person}
            onClick={() => setFilterPerson(person)}
            role="radio"
            aria-checked={filterPerson === person}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400
              ${filterPerson === person
                ? 'bg-violet-600 text-white shadow-md'
                : 'bg-violet-50 text-violet-700 hover:bg-violet-100 border border-violet-200'}`}
          >
            {person} ({c})
          </button>
        );
      })}
    </div>
  );
}
