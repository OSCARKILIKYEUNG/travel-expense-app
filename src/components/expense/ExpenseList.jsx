import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../../store/AppContext';
import { sortExpenses } from '../../utils/date';
import { detectDuplicates } from '../../utils/duplicates';
import ExpenseCard from './ExpenseCard';
import DeleteConfirmDialog from './DeleteConfirmDialog';
import EditExpenseDialog from './EditExpenseDialog';

export default function ExpenseList() {
  const { t } = useTranslation();
  const { expenses, filterPerson, removeExpense, updateExpense } = useApp();

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);

  const duplicateIds = useMemo(() => detectDuplicates(expenses), [expenses]);

  const filtered = useMemo(() => {
    const list = filterPerson
      ? expenses.filter((e) => {
          if ((e.assignedTo || '共同') === filterPerson) return true;
          return e.items?.some((i) => (i.assignedTo || e.assignedTo || '共同') === filterPerson);
        })
      : expenses;
    return sortExpenses(list);
  }, [expenses, filterPerson]);

  if (filtered.length === 0) {
    return (
      <div className="text-center py-16 text-slate-400">
        <p className="text-lg mb-1">{t('list.emptyTitle')}</p>
        <p className="text-sm">{t('list.emptyHint')}</p>
      </div>
    );
  }

  let lastDate = '';
  const rows = [];
  for (const item of filtered) {
    if (item.date !== lastDate) {
      lastDate = item.date;
      rows.push({ type: 'divider', date: item.date, key: `d-${item.date}` });
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
              onEdit={(e) => setEditTarget({ ...e })}
              onDelete={(e) => setDeleteTarget(e)}
            />
          )
        )}
      </div>

      <DeleteConfirmDialog
        open={!!deleteTarget}
        expense={deleteTarget}
        onConfirm={() => { removeExpense(deleteTarget.id); setDeleteTarget(null); }}
        onCancel={() => setDeleteTarget(null)}
      />

      <EditExpenseDialog
        open={!!editTarget}
        expense={editTarget}
        onSave={(updated) => { updateExpense(updated); setEditTarget(null); }}
        onCancel={() => setEditTarget(null)}
      />
    </>
  );
}
