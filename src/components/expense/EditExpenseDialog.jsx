import { useState, useEffect } from 'react';
import Dialog from '../ui/Dialog';
import { useApp } from '../../store/AppContext';
import { CATEGORIES, CURRENCY_NAMES } from '../../utils/constants';
import { formatDateToInput, formatDateToDisplay } from '../../utils/date';
import { Edit, Check } from '../ui/Icons';

export default function EditExpenseDialog({ open, expense, onSave, onCancel }) {
  const { people } = useApp();
  const [form, setForm] = useState(null);

  useEffect(() => {
    if (expense) setForm({ ...expense });
  }, [expense]);

  if (!open || !form) return null;

  const patch = (updates) => setForm((p) => ({ ...p, ...updates }));

  const patchItem = (idx, updates) => {
    const items = [...(form.items || [])];
    items[idx] = { ...items[idx], ...updates };
    patch({ items });
  };

  const removeItem = (idx) => patch({ items: form.items.filter((_, i) => i !== idx) });

  const addItem = (name, price) => {
    patch({ items: [...(form.items || []), { name, price: parseFloat(price) || 0, assignedTo: form.assignedTo || '共同' }] });
  };

  return (
    <Dialog open={open} onClose={onCancel} title="編輯記錄" size="lg">
      <div className="space-y-4">
        <div>
          <label htmlFor="edit-date" className="block text-sm font-medium text-slate-700 mb-1">日期</label>
          <input
            id="edit-date"
            type="date"
            defaultValue={formatDateToInput(form.date)}
            onBlur={(e) => patch({ date: formatDateToDisplay(e.target.value) })}
            className="input-field"
          />
        </div>

        <div>
          <label htmlFor="edit-store" className="block text-sm font-medium text-slate-700 mb-1">店舖名稱</label>
          <input id="edit-store" type="text" defaultValue={form.store} onBlur={(e) => patch({ store: e.target.value })} className="input-field" />
        </div>

        <div>
          <label htmlFor="edit-location" className="block text-sm font-medium text-slate-700 mb-1">地點</label>
          <input id="edit-location" type="text" defaultValue={form.location} onBlur={(e) => patch({ location: e.target.value })} className="input-field" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="edit-category" className="block text-sm font-medium text-slate-700 mb-1">類別</label>
            <select id="edit-category" defaultValue={form.category} onChange={(e) => patch({ category: e.target.value })} className="input-field">
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="edit-person" className="block text-sm font-medium text-slate-700 mb-1">分配給</label>
            <select id="edit-person" value={form.assignedTo || '共同'} onChange={(e) => patch({ assignedTo: e.target.value })} className="input-field">
              {people.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="edit-currency" className="block text-sm font-medium text-slate-700 mb-1">幣別</label>
            <select id="edit-currency" defaultValue={form.currency} onChange={(e) => patch({ currency: e.target.value })} className="input-field">
              {Object.entries(CURRENCY_NAMES).map(([code, name]) => <option key={code} value={code}>{code} - {name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="edit-amount" className="block text-sm font-medium text-slate-700 mb-1">實付金額</label>
            <input
              id="edit-amount"
              type="number"
              value={form.originalAmount || ''}
              onChange={(e) => patch({ originalAmount: parseFloat(e.target.value) || 0 })}
              className="input-field"
            />
          </div>
        </div>

        <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
          <p className="text-xs font-bold text-slate-500 mb-1">稅務 / 折扣（選填）</p>
          <p className="text-[10px] text-slate-400 mb-2">細項金額建議填收據標價；免稅時「退稅」為負數（實付 − 標價小計）。</p>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label htmlFor="edit-subtotal" className="block text-[10px] text-slate-500 mb-0.5">標價小計</label>
              <input id="edit-subtotal" type="number" value={form.subtotal || ''} onChange={(e) => patch({ subtotal: parseFloat(e.target.value) || 0 })} className="input-field text-xs" />
            </div>
            <div>
              <label htmlFor="edit-taxrefund" className="block text-[10px] text-slate-500 mb-0.5">免稅／退稅</label>
              <input id="edit-taxrefund" type="number" value={form.taxRefund || ''} onChange={(e) => patch({ taxRefund: parseFloat(e.target.value) || 0 })} placeholder="-1844" className="input-field text-xs" />
            </div>
            <div>
              <label htmlFor="edit-discount" className="block text-[10px] text-slate-500 mb-0.5">折扣</label>
              <input id="edit-discount" type="number" value={form.discount || ''} onChange={(e) => patch({ discount: parseFloat(e.target.value) || 0 })} placeholder="-200" className="input-field text-xs" />
            </div>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-slate-700 mb-0.5">細項</p>
          <p className="text-[10px] text-slate-400 mb-2">每行金額為標價（含稅），與收據一致</p>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {(form.items || []).map((item, idx) => (
              <div key={idx} className="flex gap-1.5 items-center bg-white p-1.5 rounded-lg border border-slate-200">
                <input type="text" value={item.name || ''} onChange={(e) => patchItem(idx, { name: e.target.value })} placeholder="品名…" className="input-field flex-1 !py-1.5 text-xs" />
                <input type="number" value={item.price || ''} onChange={(e) => patchItem(idx, { price: parseFloat(e.target.value) || 0 })} className="input-field w-20 !py-1.5 text-xs" />
                <select value={item.assignedTo || form.assignedTo || '共同'} onChange={(e) => patchItem(idx, { assignedTo: e.target.value })} className="input-field w-20 !py-1.5 text-xs">
                  {people.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600 px-1.5 font-bold text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 rounded" aria-label="刪除此細項">×</button>
              </div>
            ))}
          </div>
          <div className="flex gap-1.5 mt-2">
            <input id="new-item-name" type="text" placeholder="品名…" className="input-field flex-1 text-xs" />
            <input id="new-item-price" type="number" placeholder="金額…" className="input-field w-20 text-xs" />
            <button
              onClick={() => {
                const n = document.getElementById('new-item-name');
                const p = document.getElementById('new-item-price');
                if (n.value.trim()) { addItem(n.value.trim(), p.value); n.value = ''; p.value = ''; }
              }}
              className="btn-primary !py-1.5 text-xs !px-3"
            >
              新增
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-3 mt-6 pt-4 border-t border-slate-200">
        <button onClick={onCancel} className="btn-secondary flex-1">取消</button>
        <button onClick={() => onSave(form)} className="btn-primary flex-1 flex items-center justify-center gap-2">
          <Check size={18} /> 儲存
        </button>
      </div>
    </Dialog>
  );
}
