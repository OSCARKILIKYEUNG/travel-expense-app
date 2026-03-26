import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../store/AppContext';
import { CURRENCY_NAMES } from '../utils/constants';
import { normalizeUiLanguage } from '../utils/locale';
import { copyReport, exportExpenses, exportFullBackup, importData } from '../services/ExportService';
import TripManager from '../components/trip/TripManager';
import { Copy, Download, FileText, Upload, Trash2, Edit } from '../components/ui/Icons';
import Dialog from '../components/ui/Dialog';

export default function Settings() {
  const { t } = useTranslation();
  const { settings, updateSettings, people, setPeople, expenses, setExpenses, notify, renamePerson, homeCurrencyCode } = useApp();
  const { exchangeRates, homeCurrency, customCurrencyCode, customCurrencyRate, uiLanguage } = settings;
  const importRef = useRef(null);

  const [newPerson, setNewPerson] = useState('');
  const [deletePerson, setDeletePerson] = useState(null);
  const [editPerson, setEditPerson] = useState(null);
  const [editPersonName, setEditPersonName] = useState('');

  const handleAddPerson = () => {
    const name = newPerson.trim();
    if (!name) return;
    if (people.includes(name)) { notify(t('toast.personExists'), 'warning'); return; }
    setPeople((p) => [...p, name]);
    setNewPerson('');
    notify(t('toast.personAdded'));
  };

  const openEditPerson = (name) => {
    setEditPerson(name);
    setEditPersonName(name);
  };

  const saveEditPerson = () => {
    if (!editPerson) return;
    const r = renamePerson(editPerson, editPersonName);
    if (r.ok) {
      setEditPerson(null);
      return;
    }
    if (r.reason === 'exists') notify(t('toast.personExists'), 'warning');
    else if (r.reason === 'empty') notify(t('trip.nameEmpty'), 'warning');
  };

  const confirmDeletePerson = () => {
    const name = deletePerson;
    setPeople((p) => p.filter((x) => x !== name));
    const count = expenses.filter((e) => e.assignedTo === name).length;
    if (count > 0) {
      setExpenses((prev) => prev.map((e) => (e.assignedTo === name ? { ...e, assignedTo: '共同' } : e)));
    }
    setDeletePerson(null);
    notify(t('toast.personDeleted'));
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await importData(file);
      setExpenses(data.expenses);
      if (data.settings) {
        updateSettings({
          exchangeRates: data.settings.exchangeRates || exchangeRates,
          ...(data.settings.uiLanguage != null
            ? { uiLanguage: normalizeUiLanguage(data.settings.uiLanguage) }
            : {}),
        });
      }
      notify(t('toast.importOk'));
    } catch (err) {
      notify(err.message, 'error');
    }
    e.target.value = '';
  };

  const handleCopyReport = async () => {
    if (!expenses.length) return;
    try {
      await copyReport(expenses, homeCurrencyCode);
      notify(t('dashboard.copied'));
    } catch {
      notify(t('dashboard.copyFailed'), 'error');
    }
  };

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-slate-900">{t('settings.title')}</h1>

      <section className="card p-4 space-y-3">
        <h2 className="text-sm font-bold text-slate-700">{t('settings.language')}</h2>
        <select
          value={uiLanguage ?? 'zh-TW'}
          onChange={(e) => updateSettings({ uiLanguage: e.target.value })}
          className="input-field"
        >
          <option value="zh-TW">{t('settings.languageZhTW')}</option>
          <option value="en">{t('settings.languageEn')}</option>
        </select>
      </section>

      <section className="card p-4 space-y-3">
        <h2 className="text-sm font-bold text-slate-700">{t('settings.currencyTitle')}</h2>
        <select
          value={homeCurrency}
          onChange={(e) => updateSettings({
            homeCurrency: e.target.value,
            ...(e.target.value !== 'OTHER' ? { customCurrencyCode: '', customCurrencyRate: 1 } : {}),
          })}
          className="input-field"
        >
          {Object.keys(CURRENCY_NAMES).map((code) => (
            <option key={code} value={code}>
              {code} - {t(`currency.${code}`)}
            </option>
          ))}
          <option value="OTHER">{t('settings.otherCurrency')}</option>
        </select>

        {homeCurrency === 'OTHER' && (
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
            <div>
              <label htmlFor="s-custom-code" className="block text-xs text-slate-600 mb-0.5">{t('settings.currencyCode')}</label>
              <input id="s-custom-code" type="text" value={customCurrencyCode} onChange={(e) => updateSettings({ customCurrencyCode: e.target.value.toUpperCase() })} maxLength={3} className="input-field text-xs uppercase" placeholder="CHF" autoComplete="off" />
            </div>
            <div>
              <label htmlFor="s-custom-rate" className="block text-xs text-slate-600 mb-0.5">{t('settings.rateCustomForeign', { home: homeCurrencyCode, custom: customCurrencyCode || '…' })}</label>
              <input id="s-custom-rate" type="number" step="0.0001" value={customCurrencyRate} onChange={(e) => updateSettings({ customCurrencyRate: parseFloat(e.target.value) || 1 })} className="input-field text-xs" />
            </div>
          </div>
        )}
      </section>

      <section className="card p-4 space-y-3">
        <h2 className="text-sm font-bold text-slate-700">{t('settings.ratesTitle', { home: homeCurrencyCode })}</h2>
        <p className="text-[10px] text-slate-500">{t('settings.ratesHint')}</p>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto">
          {Object.keys(CURRENCY_NAMES).map((code) => (
            <div key={code} className="bg-slate-50 p-2 rounded-lg border border-slate-200">
              <label className="block text-[10px] text-slate-500 mb-0.5">{code}</label>
              <p className="text-[9px] text-slate-400 mb-0.5 tabular-nums">{t('settings.rateOneHomeLabel', { home: homeCurrencyCode })}</p>
              <input
                type="number"
                step="0.0001"
                defaultValue={exchangeRates[code]}
                disabled={code === homeCurrencyCode}
                onBlur={(e) => updateSettings({ exchangeRates: { ...exchangeRates, [code]: parseFloat(e.target.value) || 1 } })}
                className="w-full p-1 text-xs border border-slate-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400 disabled:bg-slate-100 disabled:text-slate-500"
              />
            </div>
          ))}
        </div>
      </section>

      <section className="card p-4">
        <TripManager />
      </section>

      <section className="card p-4 space-y-3">
        <h2 className="text-sm font-bold text-slate-700">{t('settings.peopleTitle')}</h2>
        <div className="space-y-1.5 max-h-36 overflow-y-auto">
          {people.map((person) => (
            <div key={person} className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
              <span className="flex-1 text-sm">{person}</span>
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => openEditPerson(person)}
                  className="text-slate-400 hover:text-indigo-600 p-1 rounded-lg hover:bg-indigo-50 transition-colors"
                  aria-label={`${t('settings.editPersonTitle')}: ${person}`}
                >
                  <Edit size={14} />
                </button>
                {people.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setDeletePerson(person)}
                    className="text-red-400 hover:text-red-600 p-1 rounded-lg hover:bg-red-50 transition-colors"
                    aria-label={`${t('settings.confirmDelete')} ${person}`}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newPerson}
            onChange={(e) => setNewPerson(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddPerson(); }}
            placeholder={t('settings.newPersonPlaceholder')}
            className="input-field flex-1 text-sm"
            autoComplete="off"
          />
          <button type="button" onClick={handleAddPerson} className="btn-primary !py-2 !px-4 text-sm">{t('settings.addPerson')}</button>
        </div>
      </section>

      <section className="card p-4 space-y-3">
        <h2 className="text-sm font-bold text-slate-700">{t('settings.dataTitle')}</h2>
        <p className="text-[10px] text-slate-500 leading-snug">
          {t('settings.dataHint')}
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => exportExpenses(expenses)} className="btn-ghost flex-1 min-w-[100px] flex items-center justify-center gap-2 border border-slate-200 text-sm">
            <Download size={16} /> {t('settings.export')}
          </button>
          <label className="btn-ghost flex-1 min-w-[100px] flex items-center justify-center gap-2 border border-slate-200 text-sm cursor-pointer">
            <Upload size={16} /> {t('settings.import')}
            <input type="file" accept=".json" ref={importRef} onChange={handleImport} className="hidden" />
          </label>
          <button type="button" onClick={() => exportFullBackup(expenses, settings)} className="btn-ghost flex-1 min-w-[100px] flex items-center justify-center gap-2 border border-slate-200 text-sm">
            <Download size={16} /> {t('settings.fullBackup')}
          </button>
        </div>
        <button
          type="button"
          onClick={handleCopyReport}
          disabled={!expenses.length}
          className="btn-ghost w-full flex items-center justify-center gap-2 border border-slate-200 text-sm disabled:opacity-50"
        >
          <Copy size={16} /> {t('settings.copyReport')}
        </button>
        {/* 列印：與舊版首頁相同，預設隱藏；移除 button 的 className「hidden」即可顯示 */}
        <button
          type="button"
          className="hidden w-full flex items-center justify-center gap-2 border border-slate-200 text-sm rounded-xl py-2.5 text-slate-600 hover:bg-slate-50"
          onClick={() => window.print()}
          disabled={!expenses.length}
        >
          <FileText size={16} /> {t('settings.printPage')}
        </button>
      </section>

      <Dialog open={!!editPerson} onClose={() => setEditPerson(null)} size="sm">
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-slate-900">{t('settings.editPersonTitle')}</h3>
          <div>
            <label htmlFor="edit-person-name" className="block text-sm font-medium text-slate-700 mb-1">{t('settings.editPersonNameLabel')}</label>
            <input
              id="edit-person-name"
              type="text"
              value={editPersonName}
              onChange={(e) => setEditPersonName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveEditPerson(); }}
              className="input-field"
              autoComplete="off"
            />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button type="button" onClick={() => setEditPerson(null)} className="btn-secondary flex-1">{t('settings.cancel')}</button>
          <button type="button" onClick={saveEditPerson} className="btn-primary flex-1">{t('settings.savePersonName')}</button>
        </div>
      </Dialog>

      <Dialog open={!!deletePerson} onClose={() => setDeletePerson(null)} size="sm">
        <div className="text-center mb-4">
          <div className="mx-auto w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mb-3">
            <span className="text-2xl">⚠️</span>
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-1">{t('settings.deletePersonTitle', { name: deletePerson })}</h3>
          <p className="text-sm text-slate-600">{t('settings.deletePersonHint')}</p>
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={() => setDeletePerson(null)} className="btn-secondary flex-1">{t('settings.cancel')}</button>
          <button type="button" onClick={confirmDeletePerson} className="btn-danger flex-1">{t('settings.confirmDelete')}</button>
        </div>
      </Dialog>
    </div>
  );
}
