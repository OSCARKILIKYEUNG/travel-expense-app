import { CURRENCY_NAMES } from '../utils/constants';

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportExpenses(expenses) {
  const blob = new Blob([JSON.stringify(expenses, null, 2)], { type: 'application/json' });
  download(blob, `travel_backup_${new Date().toISOString().slice(0, 10)}.json`);
}

export function exportFullBackup(expenses, settings) {
  const data = { expenses, settings, backupDate: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  download(blob, `旅遊記帳_完整備份_${new Date().toISOString().slice(0, 10)}.json`);
}

export function importData(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        if (Array.isArray(parsed)) {
          resolve({ expenses: parsed });
        } else if (parsed.expenses && Array.isArray(parsed.expenses)) {
          resolve(parsed);
        } else {
          reject(new Error('格式錯誤'));
        }
      } catch {
        reject(new Error('匯入失敗'));
      }
    };
    reader.readAsText(file);
  });
}

export function generateReport(expenses) {
  const totalHKD = expenses.reduce((a, c) => a + c.hkdAmount, 0);
  const header = `🧳 旅行記帳報告\n========================\n📅 報告生成時間: ${new Date().toLocaleString('zh-TW')}\n📊 記錄總數: ${expenses.length} 筆\n💰 總花費: HKD $${Math.round(totalHKD).toLocaleString()}\n========================\n`;

  const details = expenses
    .map(
      (e) =>
        `\n📍 ${e.date}\n🏪 店舖: ${e.store}\n📌 地點: ${e.location}\n🏷️ 種類: ${e.category}\n📝 細項: ${e.items.map((i) => i.name).join(', ')}\n💵 花費: ${e.originalAmount} ${e.currency} = HKD $${Math.round(e.hkdAmount)}\n------------------------`
    )
    .join('\n');

  return `${header}${details}\n\n========================\n💵 總計: HKD $${Math.round(totalHKD).toLocaleString()}\n========================`;
}

export function copyReport(expenses) {
  const text = generateReport(expenses);
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
  return Promise.resolve();
}
