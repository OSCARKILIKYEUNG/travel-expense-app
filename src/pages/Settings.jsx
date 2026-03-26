import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../store/AppContext';
import { normalizeUiLanguage } from '../utils/locale';
import { copyReport, exportExpenses, exportFullBackup, importData } from '../services/ExportService';
import {
  fetchFrankfurterRates,
  mergeExchangeRates,
  FRANKFURTER_SUPPORTED,
  FRANKFURTER_GRID_CODES,
} from '../services/ExchangeRateService';
import { canFetchLiveRates } from '../utils/tripMoney';
import TripManager from '../components/trip/TripManager';
import { Copy, Download, FileText, Upload, Trash2, Edit } from '../components/ui/Icons';
import Dialog from '../components/ui/Dialog';

export default function Settings() {
  const { t, i18n } = useTranslation();
  const {
    settings,
    updateSettings,
    people,
    setPeople,
    expenses,
    setExpenses,
    notify,
    renamePerson,
    homeCurrencyCode,
    removePersonWithReassign,
    currentTrip,
    currentTripId,
    updateTrip,
    exchangeRates,
  } = useApp();

  const uiLanguage = settings?.uiLanguage ?? 'zh-TW';
  const exchangeRatesUpdatedAt = currentTrip?.exchangeRatesUpdatedAt;
  const manualRateCodes = currentTrip?.manualRateCodes || [];

  const importRef = useRef(null);

  const [newPerson, setNewPerson] = useState('');
  const [deletePerson, setDeletePerson] = useState(null);
  const [deleteReassignTo, setDeleteReassignTo] = useState('');
  const [editPerson, setEditPerson] = useState(null);
  const [editPersonName, setEditPersonName] = useState('');
  const [ratesLoading, setRatesLoading] = useState(false);
  const [addManualCode, setAddManualCode] = useState('');

  const rateGridCodes = [
    ...FRANKFURTER_GRID_CODES,
    ...manualRateCodes.filter((c) => !FRANKFURTER_GRID_CODES.includes(c)),
  ];

  const patchTripRates = (nextRates, nextManual, nextUpdated) => {
    updateTrip(currentTripId, {
      exchangeRates: nextRates,
      manualRateCodes: nextManual,
      ...(nextUpdated !== undefined ? { exchangeRatesUpdatedAt: nextUpdated } : {}),
    });
  };

  const handleFetchRatesClick = async () => {
    if (!currentTrip || !canFetchLiveRates(currentTrip)) {
      notify(t('settings.ratesManualOnlyHint'), 'info');
      return;
    }
    const home = homeCurrencyCode;
    if (!FRANKFURTER_SUPPORTED.has(home)) {
      notify(t('toast.currencyNoLiveRate', { code: home }), 'info');
      return;
    }
    setRatesLoading(true);
    try {
      const fetched = await fetchFrankfurterRates(home);
      const merged = mergeExchangeRates(exchangeRates, fetched, home, manualRateCodes);
      patchTripRates(merged, manualRateCodes, new Date().toISOString());
      if (expenses.length === 0) notify(t('toast.fetchRatesOk'));
    } catch {
      notify(t('toast.fetchRatesFailed'), 'error');
    } finally {
      setRatesLoading(false);
    }
  };

  const handleRateBlur = (code, value) => {
    const v = parseFloat(value) || 1;
    patchTripRates({ ...exchangeRates, [code]: v }, manualRateCodes, exchangeRatesUpdatedAt);
  };

  const handleAddManualRate = () => {
    const c = addManualCode.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(c)) {
      notify(t('settings.addManualInvalid'), 'warning');
      return;
    }
    if (c === homeCurrencyCode) {
      notify(t('settings.addManualDuplicate'), 'warning');
      return;
    }
    const nextManual = [...new Set([...manualRateCodes, c])];
    patchTripRates(
      { ...exchangeRates, [c]: exchangeRates[c] ?? 1 },
      nextManual,
      exchangeRatesUpdatedAt
    );
    setAddManualCode('');
    notify(t('settings.addManualOk', { code: c }));
  };

  const handleRemoveManualRate = (code) => {
    const nextManual = manualRateCodes.filter((x) => x !== code);
    const nextRates = { ...exchangeRates };
    delete nextRates[code];
    patchTripRates(nextRates, nextManual, exchangeRatesUpdatedAt);
  };

  const handleAddPerson = () => {
    const name = newPerson.trim();
    if (!name) return;
    if (people.includes(name)) {
      notify(t('toast.personExists'), 'warning');
      return;
    }
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

  const openDeletePerson = (name) => {
    const others = people.filter((x) => x !== name);
    setDeletePerson(name);
    setDeleteReassignTo(others[0] ?? '');
  };

  const confirmDeletePerson = () => {
    if (!deletePerson || !deleteReassignTo) return;
    removePersonWithReassign(deletePerson, deleteReassignTo);
    setDeletePerson(null);
    setDeleteReassignTo('');
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await importData(file);
      setExpenses(data.expenses);
      if (data.settings?.exchangeRates && currentTripId) {
        updateTrip(currentTripId, {
          exchangeRates: { ...exchangeRates, ...data.settings.exchangeRates },
        });
      }
      if (data.settings?.uiLanguage != null) {
        updateSettings({ uiLanguage: normalizeUiLanguage(data.settings.uiLanguage) });
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

  const fetchDisabled =
    ratesLoading || !currentTrip || !canFetchLiveRates(currentTrip) || !FRANKFURTER_SUPPORTED.has(homeCurrencyCode);

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-slate-900">{t('settings.title')}</h1>

      <section className="card p-4 space-y-3">
        <h2 className="text-sm font-bold text-slate-700">{t('settings.language')}</h2>
        <select
          value={uiLanguage}
          onChange={(e) => updateSettings({ uiLanguage: e.target.value })}
          className="input-field"
        >
          <option value="zh-TW">{t('settings.languageZhTW')}</option>
          <option value="en">{t('settings.languageEn')}</option>
        </select>
      </section>

      <section className="card p-4">
        <TripManager />
      </section>

      <section className="card p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-700">{t('settings.ratesTitle', { home: homeCurrencyCode })}</h2>
            <p className="text-[10px] text-slate-500">{t('settings.ratesHintTrip')}</p>
            {exchangeRatesUpdatedAt && (
              <p className="text-[10px] text-slate-400 mt-1">
                {t('settings.ratesLastUpdated')}: {new Date(exchangeRatesUpdatedAt).toLocaleString(i18n.language?.startsWith('en') ? 'en' : 'zh-TW')}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleFetchRatesClick}
            disabled={fetchDisabled}
            className="btn-secondary !py-1.5 !px-3 text-xs shrink-0"
          >
            {ratesLoading ? t('settings.fetchRatesLoading') : t('settings.fetchRates')}
          </button>
        </div>

        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[140px]">
            <label htmlFor="add-manual-rate" className="block text-[10px] text-slate-600 mb-0.5">{t('settings.addManualLabel')}</label>
            <div className="flex gap-2">
              <input
                id="add-manual-rate"
                type="text"
                value={addManualCode}
                onChange={(e) => setAddManualCode(e.target.value.toUpperCase())}
                maxLength={3}
                placeholder="TWD"
                className="input-field text-xs uppercase flex-1"
                autoComplete="off"
              />
              <button type="button" onClick={handleAddManualRate} className="btn-secondary !py-2 !px-3 text-xs shrink-0">
                {t('settings.addManual')}
              </button>
            </div>
            <p className="text-[9px] text-slate-400 mt-1">{t('settings.addManualHint')}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto">
          {rateGridCodes.map((code) => {
            const isManual = manualRateCodes.includes(code);
            return (
              <div key={code} className="bg-slate-50 p-2 rounded-lg border border-slate-200 relative">
                <div className="flex items-center justify-between gap-1 mb-0.5">
                  <label className="block text-[10px] text-slate-500">{code}</label>
                  {isManual && (
                    <span className="text-[8px] font-bold text-amber-700 bg-amber-100 px-1 rounded">{t('settings.rateManualBadge')}</span>
                  )}
                </div>
                <p className="text-[9px] text-slate-400 mb-0.5 tabular-nums">{t('settings.rateOneHomeLabel', { home: homeCurrencyCode })}</p>
                <input
                  key={`${code}-${exchangeRates[code]}`}
                  type="number"
                  step="0.0001"
                  defaultValue={exchangeRates[code] ?? 1}
                  disabled={code === homeCurrencyCode}
                  onBlur={(e) => handleRateBlur(code, e.target.value)}
                  className="w-full p-1 text-xs border border-slate-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400 disabled:bg-slate-100 disabled:text-slate-500"
                />
                {isManual && (
                  <button
                    type="button"
                    onClick={() => handleRemoveManualRate(code)}
                    className="mt-1 text-[9px] text-red-500 hover:underline w-full text-left"
                  >
                    {t('settings.removeManual')}
                  </button>
                )}
              </div>
            );
          })}
        </div>
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
                    onClick={() => openDeletePerson(person)}
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

      <Dialog open={!!deletePerson} onClose={() => { setDeletePerson(null); setDeleteReassignTo(''); }} size="sm">
        <div className="text-center mb-4">
          <div className="mx-auto w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mb-3">
            <span className="text-2xl">⚠️</span>
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-1">{t('settings.deletePersonTitle', { name: deletePerson })}</h3>
          <p className="text-sm text-slate-600">{t('settings.deletePersonHint')}</p>
        </div>
        <div className="mb-4">
          <label htmlFor="delete-reassign" className="block text-sm font-medium text-slate-700 mb-1 text-left">{t('settings.deletePersonReassignLabel')}</label>
          <select
            id="delete-reassign"
            value={deleteReassignTo}
            onChange={(e) => setDeleteReassignTo(e.target.value)}
            className="input-field w-full"
          >
            {people.filter((p) => p !== deletePerson).map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={() => { setDeletePerson(null); setDeleteReassignTo(''); }} className="btn-secondary flex-1">{t('settings.cancel')}</button>
          <button type="button" onClick={confirmDeletePerson} disabled={!deleteReassignTo} className="btn-danger flex-1 disabled:opacity-50">{t('settings.confirmDelete')}</button>
        </div>
      </Dialog>
    </div>
  );
}
