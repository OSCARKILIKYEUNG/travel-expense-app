import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import { CATEGORIES, CURRENCY_NAMES } from '../utils/constants';
import { todayISO } from '../utils/date';
import { ArrowLeft, Check } from '../components/ui/Icons';

export default function AddExpense() {
  const { people, exchangeRates, addExpense } = useApp();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    date: todayISO(),
    merchant: '',
    location: '',
    category: '飲食',
    assignedTo: '共同',
    currency: 'HKD',
    amount: '',
    subtotal: '',
    tax: '',
    taxRefund: '',
    discount: '',
    items: '',
  });

  const patch = (updates) => setForm((p) => ({ ...p, ...updates }));

  const handleSubmit = (e) => {
    e.preventDefault();
    const subtotal = parseFloat(form.subtotal) || 0;
    const taxRefund = parseFloat(form.taxRefund) || 0;
    const discount = parseFloat(form.discount) || 0;
    const calculated = subtotal + taxRefund + discount;
    const amount = calculated > 0 ? calculated : parseFloat(form.amount) || 0;
    const rate = exchangeRates[form.currency] || 1;

    const items = form.items
      .split('\n')
      .filter((l) => l.trim())
      .map((l) => ({ description: l.trim(), name: l.trim() }));

    addExpense({
      id: `exp-${Date.now()}`,
      date: form.date,
      store: form.merchant || '未命名',
      location: form.location || '',
      category: form.category,
      subtotal,
      tax: parseFloat(form.tax) || 0,
      taxRefund,
      discount,
      currency: form.currency,
      originalAmount: amount,
      hkdAmount: amount * rate,
      rate,
      assignedTo: form.assignedTo,
      items,
    });

    navigate('/');
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-ghost !p-2 !rounded-xl" aria-label="返回">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-slate-900">新增記錄</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Basic info */}
        <div className="card p-4 space-y-4">
          <h2 className="text-sm font-bold text-slate-700">基本資料</h2>
          <div>
            <label htmlFor="add-date" className="block text-xs font-medium text-slate-600 mb-1">日期</label>
            <input id="add-date" type="date" value={form.date} onChange={(e) => patch({ date: e.target.value })} required className="input-field" />
          </div>
          <div>
            <label htmlFor="add-merchant" className="block text-xs font-medium text-slate-600 mb-1">店舖</label>
            <input id="add-merchant" type="text" value={form.merchant} onChange={(e) => patch({ merchant: e.target.value })} required className="input-field" placeholder="商店名稱…" autoComplete="off" />
          </div>
          <div>
            <label htmlFor="add-location" className="block text-xs font-medium text-slate-600 mb-1">地點</label>
            <input id="add-location" type="text" value={form.location} onChange={(e) => patch({ location: e.target.value })} className="input-field" placeholder="城市或區域…" autoComplete="off" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="add-category" className="block text-xs font-medium text-slate-600 mb-1">類別</label>
              <select id="add-category" value={form.category} onChange={(e) => patch({ category: e.target.value })} className="input-field">
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="add-person" className="block text-xs font-medium text-slate-600 mb-1">分配給</label>
              <select id="add-person" value={form.assignedTo} onChange={(e) => patch({ assignedTo: e.target.value })} className="input-field">
                {people.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Amount */}
        <div className="card p-4 space-y-4">
          <h2 className="text-sm font-bold text-slate-700">金額</h2>
          <div>
            <label htmlFor="add-currency" className="block text-xs font-medium text-slate-600 mb-1">幣別</label>
            <select id="add-currency" value={form.currency} onChange={(e) => patch({ currency: e.target.value })} className="input-field">
              {Object.entries(CURRENCY_NAMES).map(([code, name]) => <option key={code} value={code}>{code} - {name}</option>)}
            </select>
          </div>

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-3">
            <p className="text-[10px] font-bold text-slate-500">擇一填寫</p>
            <div>
              <label htmlFor="add-amount" className="block text-[10px] text-slate-500 mb-0.5">實付金額</label>
              <input id="add-amount" type="number" step="0.01" value={form.amount} onChange={(e) => patch({ amount: e.target.value })} className="input-field text-xs" placeholder="直接輸入實付金額…" />
            </div>
            <div className="border-t border-slate-200 pt-3 space-y-2">
              <p className="text-[10px] text-slate-500 font-medium">或分項填寫</p>
              <div>
                <label htmlFor="add-subtotal" className="block text-[10px] text-slate-500 mb-0.5">商品小計</label>
                <input id="add-subtotal" type="number" step="0.01" value={form.subtotal} onChange={(e) => patch({ subtotal: e.target.value })} className="input-field text-xs" />
              </div>
              <div>
                <label htmlFor="add-tax" className="block text-[10px] text-slate-500 mb-0.5">消費稅</label>
                <input id="add-tax" type="number" step="0.01" value={form.tax} onChange={(e) => patch({ tax: e.target.value })} className="input-field text-xs" />
              </div>
              <div>
                <label htmlFor="add-taxrefund" className="block text-[10px] text-slate-500 mb-0.5">退稅（負數）</label>
                <input id="add-taxrefund" type="number" step="0.01" value={form.taxRefund} onChange={(e) => patch({ taxRefund: e.target.value })} className="input-field text-xs" placeholder="-2557" />
              </div>
              <div>
                <label htmlFor="add-discount" className="block text-[10px] text-slate-500 mb-0.5">折扣（負數）</label>
                <input id="add-discount" type="number" step="0.01" value={form.discount} onChange={(e) => patch({ discount: e.target.value })} className="input-field text-xs" placeholder="-200" />
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="add-items" className="block text-xs font-medium text-slate-600 mb-1">細項（每行一項）</label>
            <textarea id="add-items" value={form.items} onChange={(e) => patch({ items: e.target.value })} rows={3} className="input-field resize-none" placeholder="輸入品項名稱，每行一項…" />
          </div>
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary flex-1">取消</button>
          <button type="submit" className="btn-primary flex-1 flex items-center justify-center gap-2">
            <Check size={18} /> 新增
          </button>
        </div>
      </form>
    </div>
  );
}
