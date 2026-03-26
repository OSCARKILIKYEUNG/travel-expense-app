/**
 * 人物列表中，新支出／未標 assignee 時的預設負責人。
 * 若列表含「共同」則用共同；否則用第一人（與人物管理一致）。
 */
export function getDefaultAssignee(people) {
  if (!Array.isArray(people) || people.length === 0) return '共同';
  if (people.includes('共同')) return '共同';
  return people[0];
}

/** 已存 assignee 優先；空則與 getDefaultAssignee 一致 */
export function resolveAssigneeDisplay(stored, people) {
  if (stored != null && String(stored).trim() !== '') return String(stored).trim();
  return getDefaultAssignee(people);
}
