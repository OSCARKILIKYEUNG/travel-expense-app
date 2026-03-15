import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import { CURRENCY_NAMES } from '../utils/constants';
import { getExchangeRate } from '../utils/currency';
import { Save, FileText, Copy, BarChart, Plus } from '../components/ui/Icons';
import { exportFullBackup, copyReport } from '../services/ExportService';
import PersonFilter from '../components/expense/PersonFilter';
import ExpenseList from '../components/expense/ExpenseList';
import UploadArea from '../components/expense/UploadArea';

export default function Dashboard() {
  const { expenses, filterPerson, people, settings, exchangeRates, notify } = useApp();

  const totalHKD = useMemo(() => {
    if (!filterPerson) return expenses.reduce((a, c) => a + c.hkdAmount, 0);
    let total = 0;
    for (const e of expenses) {
      const whole = (e.assignedTo || '共同') === filterPerson;
      if (whole) {
        total += e.hkdAmount;
      } else if (e.items?.some((i) => (i.assignedTo || e.assignedTo || '共同') === filterPerson)) {
        for (const item of e.items) {
          if ((item.assignedTo || e.assignedTo || '共同') === filterPerson) {
            total += (item.price || 0) * getExchangeRate(e.currency || 'HKD', exchangeRates);
          }
        }
      }
    }
    return total;
  }, [expenses, filterPerson, exchangeRates]);

  const recordCount = useMemo(() => {
    if (!filterPerson) return expenses.length;
    return expenses.filter((e) => {
      if ((e.assignedTo || '共同') === filterPerson) return true;
      return e.items?.some((i) => (i.assignedTo || e.assignedTo || '共同') === filterPerson);
    }).length;
  }, [expenses, filterPerson]);

  const currencySums = useMemo(() => {
    const map = {};
    for (const e of expenses) {
      if (filterPerson) {
        const whole = (e.assignedTo || '共同') === filterPerson;
        const hasItems = e.items?.some((i) => (i.assignedTo || e.assignedTo || '共同') === filterPerson);
        if (!whole && !hasItems) continue;
        if (!whole && hasItems) {
          for (const item of e.items) {
            if ((item.assignedTo || e.assignedTo || '共同') === filterPerson) {
              const c = e.originalCurrency || e.currency || 'HKD';
              map[c] = (map[c] || 0) + (item.price || 0);
            }
          }
          continue;
        }
      }
      const c = e.originalCurrency || e.currency || 'HKD';
      const amt = e.originalAmount || e.hkdAmount || 0;
      if (amt > 0) map[c] = (map[c] || 0) + amt;
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [expenses, filterPerson]);

  const handleCopy = async () => {
    if (!expenses.length) return;
    try { await copyReport(expenses); notify('已複製到剪貼簿'); }
    catch { notify('複製失敗', 'error'); }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-5">
      {/* Summary Card */}
      <section className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl p-5 text-white shadow-xl relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(255,255,255,0.1),transparent_60%)]" />
        <div className="relative z-10">
          <p className="text-indigo-200 text-xs font-medium mb-0.5">
            總花費 (HKD){filterPerson && ` · ${filterPerson}`}
          </p>
          <h2 className="text-3xl lg:text-4xl font-bold mb-0.5 tabular-nums">
            ${Math.round(totalHKD).toLocaleString()}
          </h2>
          <p className="text-indigo-300 text-xs mb-4">共 {recordCount} 筆記錄</p>

          {currencySums.length > 0 && (
            <div className="border-t border-white/20 pt-3 mb-4">
              <p className="text-indigo-200 text-[10px] font-medium mb-1.5">原幣值總和</p>
              {currencySums.map(([curr, amount]) => (
                <div key={curr} className="flex justify-between items-center text-xs mb-0.5">
                  <span className="text-indigo-200">{CURRENCY_NAMES[curr] || curr}</span>
                  <span className="font-bold">{curr} ${Math.round(amount).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-4 gap-2">
            <button onClick={() => exportFullBackup(expenses, settings)} className="bg-white/15 hover:bg-white/25 border border-white/20 py-2 rounded-xl text-xs font-bold flex flex-col items-center gap-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50">
              <Save size={14} /><span>備份</span>
            </button>
            <button onClick={handlePrint} disabled={!expenses.length} className="bg-white text-indigo-700 py-2 rounded-xl text-xs font-bold flex flex-col items-center gap-1 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50">
              <FileText size={14} /><span>列印</span>
            </button>
            <button onClick={handleCopy} disabled={!expenses.length} className="bg-white/15 hover:bg-white/25 border border-white/20 py-2 rounded-xl text-xs font-bold flex flex-col items-center gap-1 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50">
              <Copy size={14} /><span>複製</span>
            </button>
            <Link to="/charts" className="bg-blue-500/80 hover:bg-blue-500 border border-blue-400/40 py-2 rounded-xl text-xs font-bold flex flex-col items-center gap-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50">
              <BarChart size={14} /><span>圖表</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Upload / Add */}
      <section className="space-y-3">
        <UploadArea />
        <Link
          to="/add"
          className="btn-primary w-full flex items-center justify-center gap-2 text-base !py-3.5 shadow-lg"
        >
          <Plus size={20} />
          手動新增記錄
        </Link>
      </section>

      {/* Filter + List */}
      <section>
        <PersonFilter />
        <ExpenseList />
      </section>
    </div>
  );
}
