import i18n from '../i18n';
import { getItemDisplayName, pickLocalized } from '../utils/displayNames';

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
  const prefix = i18n.t('export.backupFilename');
  download(blob, `${prefix}_${new Date().toISOString().slice(0, 10)}.json`);
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
          reject(new Error(i18n.t('export.importFormatError')));
        }
      } catch {
        reject(new Error(i18n.t('export.importFailed')));
      }
    };
    reader.readAsText(file);
  });
}

export function generateReport(expenses, homeCurrencyCode = 'HKD') {
  const t = i18n.t.bind(i18n);
  const lang = i18n.language || 'zh-TW';
  const locale = lang.startsWith('en') ? 'en' : 'zh-TW';
  const code = homeCurrencyCode || 'HKD';
  const totalHome = expenses.reduce((a, c) => a + c.hkdAmount, 0);
  const sep = '========================';
  const title = t('export.reportTitle');
  const time = new Date().toLocaleString(locale);
  const header = `🧳 ${title}\n${sep}\n📅 ${t('export.generatedAt')}: ${time}\n📊 ${t('export.recordLine', { count: expenses.length })}\n💰 ${t('export.totalSpend')}: ${code} $${Math.round(totalHome).toLocaleString(locale)}\n${sep}\n`;

  const details = expenses
    .map((e) => {
      const catKey = e.category || '未分類';
      const catLabel = t(`categories.${catKey}`, { defaultValue: catKey });
      const itemNames = (e.items || [])
        .map((i) => getItemDisplayName(i, lang))
        .filter(Boolean)
        .join(', ');
      const store = pickLocalized(e.store, e.storeEn, lang);
      const loc = pickLocalized(e.location, e.locationEn, lang);
      const ex = e.receiptTaxExemptionAmount
        ? `\n📋 ${t('export.receiptExemption')}: ${e.receiptTaxExemptionAmount}`
        : '';
      return `\n📍 ${e.date}\n🏪 ${t('export.store')}: ${store}\n📌 ${t('export.location')}: ${loc}\n🏷️ ${t('export.category')}: ${catLabel}\n📝 ${t('export.items')}: ${itemNames}\n💵 ${t('export.amount')}: ${e.originalAmount} ${e.currency} = ${code} $${Math.round(e.hkdAmount)}${ex}\n------------------------`;
    })
    .join('\n');

  return `${header}${details}\n\n${sep}\n💵 ${t('export.grandTotal')}: ${code} $${Math.round(totalHome).toLocaleString(locale)}\n${sep}`;
}

export function copyReport(expenses, homeCurrencyCode = 'HKD') {
  const text = generateReport(expenses, homeCurrencyCode);
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
