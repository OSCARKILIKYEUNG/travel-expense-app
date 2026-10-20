import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getExpenseStoreDisplay } from '../../utils/displayNames';
import { useApp } from '../../store/AppContext';
import { sortExpenses, expenseDateKey, expenseDateLabel } from '../../utils/date';
import { resolveAssigneeDisplay } from '../../utils/people';
import { detectDuplicates } from '../../utils/duplicates';
import { hasPricingRelatedChanges } from '../../utils/expensePricing';
import ExpenseCard from './ExpenseCard';
import ConfirmDeleteDialog from '../ui/ConfirmDeleteDialog';
import EditExpenseDialog from './EditExpenseDialog';

export default function ExpenseList() {
  const { t, i18n } = useTranslation();
  const { expenses, filterPerson, removeExpense, updateExpense, dismissExpenseDuplicate, people } = useApp();

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);

  const duplicateIds = useMemo(() => detectDuplicates(expenses), [expenses]);

  const filtered = useMemo(() => {
    const list = filterPerson
      ? expenses.filter((e) => {
          if (resolveAssigneeDisplay(e.assignedTo, people) === filterPerson) return true;
          return e.items?.some((i) => (i.assignedTo || resolveAssigneeDisplay(e.assignedTo, people)) === filterPerson);
        })
      : expenses;
    return sortExpenses(list);
  }, [expenses, filterPerson, people]);

  if (filtered.length === 0) {
    return (
      <div className="text-center py-16 text-slate-400">
        <p className="text-lg mb-1">{t('list.emptyTitle')}</p>
        <p className="text-sm">{t('list.emptyHint')}</p>
      </div>
    );
  }

  let lastKey = '';
  const rows = [];
  for (const item of filtered) {
    const dayKey = expenseDateKey(item.date);
    if (dayKey !== lastKey) {
      lastKey = dayKey;
      rows.push({ type: 'divider', date: expenseDateLabel(item.date), key: `d-${dayKey}` });
    }
    rows.push({ type: 'expense', data: item, key: item.id });
  }

  return (
    <>
      <div className="space-y-3">
        {rows.map((row) =>
          row.type === 'divider' ? (
            <div key={row.key} className="flex items-center gap-3 pt-4 pb-1">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                {row.date}
              </span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>
          ) : (
            <ExpenseCard
              key={row.key}
              expense={row.data}
              isDuplicate={duplicateIds.has(row.data.id)}
              duplicateOf={(() => {
                const info = duplicateIds.get(row.data.id);
                const other = info && expenses.find((x) => x.id === info.ofId);
                return other
                  ? { date: other.date, store: getExpenseStoreDisplay(other, i18n.language, t) }
                  : null;
              })()}
              onDismissDuplicate={(e) => dismissExpenseDuplicate(e.id)}
              onEdit={(e) => setEditTarget({ ...e })}
              onDelete={(e) => setDeleteTarget(e)}
            />
          )
        )}
      </div>

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        name={deleteTarget ? getExpenseStoreDisplay(deleteTarget, i18n.language, t) : ''}
        onConfirm={() => { removeExpense(deleteTarget.id); setDeleteTarget(null); }}
        onCancel={() => setDeleteTarget(null)}
      />

      <EditExpenseDialog
        open={!!editTarget}
        expense={editTarget}
        onSave={(updated) => {
          const prev = editTarget;
          updateExpense({
            ...updated,
            userEditedPricing: Boolean(prev?.userEditedPricing) || hasPricingRelatedChanges(prev, updated, updated.currency),
          });
          setEditTarget(null);
        }}
        onCancel={() => setEditTarget(null)}
      />
    </>
  );
}
