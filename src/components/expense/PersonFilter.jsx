import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../../store/AppContext';
import { resolveAssigneeDisplay } from '../../utils/people';

export default function PersonFilter() {
  const { t } = useTranslation();
  const { expenses, people, filterPerson, setFilterPerson } = useApp();

  const counts = useMemo(() => {
    const map = {};
    for (const person of people) {
      map[person] = expenses.filter((e) => {
        if (resolveAssigneeDisplay(e.assignedTo, people) === person) return true;
        return e.items?.some((i) => (i.assignedTo || resolveAssigneeDisplay(e.assignedTo, people)) === person);
      }).length;
    }
    return map;
  }, [expenses, people]);

  if (expenses.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mb-4" role="radiogroup" aria-label={t('filter.label')}>
      <span className="text-sm text-ink-muted font-medium self-center">{t('filter.label')}</span>
      <button
        onClick={() => setFilterPerson(null)}
        role="radio"
        aria-checked={filterPerson === null}
        className={`min-h-[36px] px-3 inline-flex items-center rounded-full text-sm font-medium transition-all
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal
          ${filterPerson === null ? 'bg-teal-strong text-white shadow-md' : 'bg-beige text-ink-soft hover:bg-line'}`}
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
            className={`min-h-[36px] px-3 inline-flex items-center rounded-full text-sm font-medium transition-all
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal
              ${filterPerson === person
                ? 'bg-teal-strong text-white shadow-md'
                : 'bg-teal-soft text-teal-strong hover:bg-beige border border-teal/40'}`}
          >
            {person} ({c})
          </button>
        );
      })}
    </div>
  );
}
