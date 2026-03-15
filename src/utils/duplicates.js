export function detectDuplicates(expenses) {
  const groups = {};
  for (const expense of expenses) {
    const count = expense.items?.length || 0;
    const amount = Math.round(expense.originalAmount || 0);
    const key = `${expense.date}_${count}_${amount}`;
    (groups[key] ||= []).push(expense.id);
  }
  const ids = new Set();
  for (const group of Object.values(groups)) {
    if (group.length > 1) group.forEach((id) => ids.add(id));
  }
  return ids;
}
