import { useState, useRef } from 'react';
import { useApp } from '../store/AppContext';
import { CURRENCY_NAMES, DEFAULT_EXCHANGE_RATES } from '../utils/constants';
import { exportExpenses, exportFullBackup, importData } from '../services/ExportService';
import DataService from '../services/DataService';
import TripManager from '../components/trip/TripManager';
import { Download, Upload, Trash2 } from '../components/ui/Icons';
import Dialog from '../components/ui/Dialog';

export default function Settings() {
  const { settings, updateSettings, people, setPeople, expenses, setExpenses, notify } = useApp();
  const { exchangeRates, defaultCurrency, customCurrencyCode, customCurrencyRate } = settings;
  const importRef = useRef(null);

  const [newPerson, setNewPerson] = useState('');
  const [deletePerson, setDeletePerson] = useState(null);

  const handleAddPerson = () => {
    const name = newPerson.trim();
    if (!name) return;
    if (people.includes(name)) { notify('此人物已存在', 'warning'); return; }
    setPeople((p) => [...p, name]);
    setNewPerson('');
    notify('已新增人物');
  };

  const confirmDeletePerson = () => {
    const name = deletePerson;
    setPeople((p) => p.filter((x) => x !== name));
    const count = expenses.filter((e) => e.assignedTo === name).length;
    if (count > 0) {
      setExpenses((prev) => prev.map((e) => (e.assignedTo === name ? { ...e, assignedTo: '共同' } : e)));
    }
    setDeletePerson(null);
    notify('已刪除人物');
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
        });
      }
      notify('匯入成功');
    } catch (err) {
      notify(err.message, 'error');
    }
    e.target.value = '';
  };

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-slate-900">設定</h1>

      {/* Currency */}
      <section className="card p-4 space-y-3">
        <h2 className="text-sm font-bold text-slate-700">記帳貨幣</h2>
        <select
          value={defaultCurrency}
          onChange={(e) => updateSettings({
            defaultCurrency: e.target.value,
            ...(e.target.value !== 'OTHER' ? { customCurrencyCode: '', customCurrencyRate: 1 } : {}),
          })}
          className="input-field"
        >
          {Object.entries(CURRENCY_NAMES).map(([code, name]) => (
            <option key={code} value={code}>{code} - {name}</option>
          ))}
          <option value="OTHER">其他貨幣</option>
        </select>

        {defaultCurrency === 'OTHER' && (
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
            <div>
              <label htmlFor="s-custom-code" className="block text-xs text-slate-600 mb-0.5">貨幣代碼</label>
              <input id="s-custom-code" type="text" value={customCurrencyCode} onChange={(e) => updateSettings({ customCurrencyCode: e.target.value.toUpperCase() })} maxLength={3} className="input-field text-xs uppercase" placeholder="CHF" autoComplete="off" />
            </div>
            <div>
              <label htmlFor="s-custom-rate" className="block text-xs text-slate-600 mb-0.5">匯率 (→ HKD)</label>
              <input id="s-custom-rate" type="number" step="0.0001" value={customCurrencyRate} onChange={(e) => updateSettings({ customCurrencyRate: parseFloat(e.target.value) || 1 })} className="input-field text-xs" />
            </div>
          </div>
        )}
      </section>

      {/* Exchange rates */}
      <section className="card p-4 space-y-3">
        <h2 className="text-sm font-bold text-slate-700">匯率 (→ HKD)</h2>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto">
          {Object.entries(CURRENCY_NAMES).map(([code]) => (
            <div key={code} className="bg-slate-50 p-2 rounded-lg border border-slate-200">
              <label className="block text-[10px] text-slate-500 mb-0.5">{code}</label>
              <input
                type="number"
                step="0.0001"
                defaultValue={exchangeRates[code]}
                onBlur={(e) => updateSettings({ exchangeRates: { ...exchangeRates, [code]: parseFloat(e.target.value) || 1 } })}
                className="w-full p-1 text-xs border border-slate-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
            </div>
          ))}
        </div>
      </section>

      {/* Trips */}
      <section className="card p-4">
        <TripManager />
      </section>

      {/* People */}
      <section className="card p-4 space-y-3">
        <h2 className="text-sm font-bold text-slate-700">人物管理</h2>
        <div className="space-y-1.5 max-h-36 overflow-y-auto">
          {people.map((person) => (
            <div key={person} className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
              <span className="flex-1 text-sm">{person}</span>
              {people.length > 1 && (
                <button
                  onClick={() => setDeletePerson(person)}
                  className="text-red-400 hover:text-red-600 p-1 rounded-lg hover:bg-red-50 transition-colors"
                  aria-label={`刪除 ${person}`}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newPerson}
            onChange={(e) => setNewPerson(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddPerson(); }}
            placeholder="新人物名稱…"
            className="input-field flex-1 text-sm"
            autoComplete="off"
          />
          <button onClick={handleAddPerson} className="btn-primary !py-2 !px-4 text-sm">新增</button>
        </div>
      </section>

      {/* Data */}
      <section className="card p-4 space-y-3">
        <h2 className="text-sm font-bold text-slate-700">資料管理</h2>
        <div className="flex gap-2">
          <button onClick={() => exportExpenses(expenses)} className="btn-ghost flex-1 flex items-center justify-center gap-2 border border-slate-200 text-sm">
            <Download size={16} /> 匯出
          </button>
          <label className="btn-ghost flex-1 flex items-center justify-center gap-2 border border-slate-200 text-sm cursor-pointer">
            <Upload size={16} /> 匯入
            <input type="file" accept=".json" ref={importRef} onChange={handleImport} className="hidden" />
          </label>
          <button onClick={() => exportFullBackup(expenses, settings)} className="btn-ghost flex-1 flex items-center justify-center gap-2 border border-slate-200 text-sm">
            <Download size={16} /> 完整備份
          </button>
        </div>
      </section>

      {/* Delete person confirm */}
      <Dialog open={!!deletePerson} onClose={() => setDeletePerson(null)} size="sm">
        <div className="text-center mb-4">
          <div className="mx-auto w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mb-3">
            <span className="text-2xl">⚠️</span>
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-1">刪除「{deletePerson}」？</h3>
          <p className="text-sm text-slate-600">相關記錄會改為「共同」</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setDeletePerson(null)} className="btn-secondary flex-1">取消</button>
          <button onClick={confirmDeletePerson} className="btn-danger flex-1">確定刪除</button>
        </div>
      </Dialog>
    </div>
  );
}
