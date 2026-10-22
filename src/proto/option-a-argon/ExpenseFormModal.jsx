import { useEffect, useState } from 'react';
import { MOCK_CATEGORIES, MOCK_PEOPLE } from '../shared/mockTrip';
import { tripDayIndex } from '../shared/dates';
import { CategoryIcon, ReceiptZigZagEdge, WashiTape } from './doodles';

const RATES_TO_HKD = {
  JPY: 0.052,
  HKD: 1,
  USD: 7.8,
  TWD: 0.24,
};

const CURRENCIES = [
  { code: 'JPY', symbol: '¥', label: 'JPY 日圓' },
  { code: 'HKD', symbol: 'HK$', label: 'HKD 港幣' },
  { code: 'USD', symbol: 'US$', label: 'USD 美金' },
  { code: 'TWD', symbol: 'NT$', label: 'TWD 台幣' },
];

const MOCK_RECEIPT_PRESETS = [
  {
    label: '一蘭拉麵 ¥1,480',
    store: '一蘭拉麵 淺草店',
    category: '飲食',
    currency: 'JPY',
    amount: 1480,
    assignedTo: 'Oscar',
    items: [
      { name: '天然豚骨拉麵', price: 980 },
      { name: '半熟鹽味蛋', price: 140 },
      { name: '替玉加麵', price: 210 },
      { name: '抹茶杏仁豆腐', price: 150 },
    ],
  },
  {
    label: '松本清藥妝 ¥5,400',
    store: '松本清 銀座店',
    category: '購物',
    currency: 'JPY',
    amount: 5400,
    assignedTo: '阿晴',
    items: [
      { name: '合利他命 EX', price: 3980 },
      { name: '休足時間 18枚', price: 720 },
      { name: '保濕面膜組', price: 700 },
    ],
  },
  {
    label: '東京メトロ 24h券 ¥800',
    store: '東京メトロ 一日券',
    category: '交通',
    currency: 'JPY',
    amount: 800,
    assignedTo: '共同',
    items: [{ name: '24小時乘車券', price: 800 }],
  },
];

const QUICK_STORES_BY_CATEGORY = {
  飲食: ['築地 玉子燒', '一蘭拉麵', 'Lawson 便利店', '銀座 燒肉'],
  交通: ['Suica 增值', '東京メトロ', 'JR 東日本', '計程車'],
  購物: ['松本清藥妝', '唐吉訶德', 'Uniqlo', 'Loft 文具'],
  住宿: ['淺草溫泉旅館', '箱根湯本飯店', '河口湖山屋'],
  娛樂: ['teamLab 門票', '晴空塔展望台', '美術館門票'],
  其他: ['投幣置物櫃', '明信片郵資', '扭蛋伴手禮'],
};

export function convertToHkd(amount, currency) {
  const num = Number(amount);
  if (!Number.isFinite(num) || num <= 0) return 0;
  const rate = RATES_TO_HKD[currency] || RATES_TO_HKD.JPY;
  return Math.round(num * rate * 10) / 10;
}

export default function ExpenseFormModal({
  trip,
  defaultDate,
  editingExpense,
  onClose,
  onSave,
  onDelete,
}) {
  const isEditing = Boolean(editingExpense);

  const [currency, setCurrency] = useState(
    editingExpense?.originalCurrency || editingExpense?.currency || 'JPY'
  );
  const [amountStr, setAmountStr] = useState(
    editingExpense
      ? String(editingExpense.originalAmount ?? editingExpense.hkdAmount ?? '')
      : '1500'
  );
  const [store, setStore] = useState(editingExpense?.store || '');
  const [date, setDate] = useState(editingExpense?.date || defaultDate);
  const [category, setCategory] = useState(editingExpense?.category || MOCK_CATEGORIES[0]);
  const [assignedTo, setAssignedTo] = useState(
    editingExpense?.assignedTo || MOCK_PEOPLE[2] || '共同'
  );
  const [items, setItems] = useState(
    editingExpense?.items?.length ? editingExpense.items.map((it) => ({ ...it })) : []
  );
  const [scanned, setScanned] = useState(Boolean(editingExpense?.scanned));
  const [scanToast, setScanToast] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');

  useEffect(() => {
    if (editingExpense) {
      setCurrency(editingExpense.originalCurrency || editingExpense.currency || 'JPY');
      setAmountStr(String(editingExpense.originalAmount ?? editingExpense.hkdAmount ?? ''));
      setStore(editingExpense.store || '');
      setDate(editingExpense.date || defaultDate);
      setCategory(editingExpense.category || MOCK_CATEGORIES[0]);
      setAssignedTo(editingExpense.assignedTo || '共同');
      setItems(editingExpense.items ? editingExpense.items.map((it) => ({ ...it })) : []);
      setScanned(Boolean(editingExpense.scanned));
    } else {
      setDate(defaultDate);
    }
  }, [editingExpense, defaultDate]);

  const numericAmount = Number(amountStr) > 0 ? Number(amountStr) : 0;
  const previewHkd = convertToHkd(numericAmount || 1500, currency);
  const dayIdx = tripDayIndex(trip, date);
  const tripDates = Object.keys(trip.days || {}).sort();

  const handleApplyScanPreset = (preset) => {
    setStore(preset.store);
    setCategory(preset.category);
    setCurrency(preset.currency);
    setAmountStr(String(preset.amount));
    setAssignedTo(preset.assignedTo);
    setItems(preset.items.map((it) => ({ ...it })));
    setScanned(true);
    setScanToast(`已掃描「${preset.store}」收據並填入明細`);
  };

  const handleAddItem = () => {
    const cleanName = newItemName.trim();
    const cleanPrice = Number(newItemPrice);
    if (!cleanName) return;
    const nextItems = [
      ...items,
      { name: cleanName, price: Number.isFinite(cleanPrice) && cleanPrice > 0 ? cleanPrice : 0 },
    ];
    setItems(nextItems);
    setNewItemName('');
    setNewItemPrice('');
  };

  const handleRemoveItem = (idx) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    const finalAmount = numericAmount > 0 ? numericAmount : 1500;
    const finalStore = store.trim() || `${category}消費 (${date.slice(5)})`;
    const finalHkd = convertToHkd(finalAmount, currency);

    onSave({
      id: editingExpense?.id ?? Date.now(),
      date: date || defaultDate,
      store: finalStore,
      category,
      currency,
      originalCurrency: currency,
      originalAmount: finalAmount,
      hkdAmount: finalHkd,
      assignedTo,
      items,
      scanned: scanned || items.length > 0,
    });
  };

  const activeCurrencySymbol =
    CURRENCIES.find((c) => c.code === currency)?.symbol || '¥';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink/45 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        data-testid="expense-form"
        onSubmit={handleSubmit}
        className="relative w-full max-w-md max-h-[92vh] flex flex-col rounded-t-card sm:rounded-card bg-cream-soft border-2 border-line overflow-hidden animate-slide-up"
      >
        {/* Decorative top washi tape */}
        <WashiTape tone="mustard" className="mx-auto -mt-1.5 h-5 w-28" rotate="rotate-0" />

        {/* Header bar */}
        <div className="flex items-center justify-between gap-2 px-4 pt-2 pb-2.5 border-b border-line bg-cream-soft">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-pill bg-mustard-soft border border-line text-mustard-ink text-meta font-semibold whitespace-nowrap">
              {isEditing ? '編輯收據' : '手帖記帳'}
            </span>
            <h2 className="font-display text-lg text-ink whitespace-nowrap">
              {isEditing ? '修改消費紀錄' : '新增旅途消費'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center px-3 py-1.5 rounded-xl bg-beige text-ink-soft text-xs font-semibold hover:bg-line transition-colors whitespace-nowrap"
          >
            關閉 ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-3.5 py-3 space-y-3.5">
          {/* 1. Mock Receipt Scanner Entry Point */}
          <div className="rounded-2xl bg-teal-soft/75 border border-teal-strong/25 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-teal-strong text-white text-xs font-bold whitespace-nowrap">
                  AI
                </span>
                <span className="font-display text-sm text-teal-strong whitespace-nowrap">
                  日本收據光學掃描 (模擬)
                </span>
              </div>
              <span className="text-meta text-teal-strong font-medium whitespace-nowrap">
                一鍵填入明細
              </span>
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5">
              {MOCK_RECEIPT_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => handleApplyScanPreset(preset)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-cream-soft border border-teal-strong/30 text-teal-strong text-meta font-semibold hover:bg-mustard-soft hover:text-ink transition-colors whitespace-nowrap"
                >
                  <span>📷</span>
                  <span className="whitespace-nowrap">{preset.label}</span>
                </button>
              ))}
            </div>

            {scanToast && (
              <p className="mt-2 text-meta font-semibold text-teal-strong bg-cream-soft/90 px-2.5 py-1 rounded-lg border border-teal-strong/20 whitespace-nowrap">
                ✓ {scanToast}
              </p>
            )}
          </div>

          {/* 2. Amount + Currency FIRST (Hero ticket box) */}
          <div className="rounded-2xl bg-cream border-2 border-line p-3">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-semibold text-ink-soft whitespace-nowrap">
                1. 幣別與金額
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-pill bg-mustard-soft text-mustard-ink text-meta font-bold whitespace-nowrap">
                折合 HK$ {previewHkd.toLocaleString('en-HK', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
              </span>
            </div>

            {/* Currency selector pills */}
            <div className="grid grid-cols-4 gap-1.5 mb-2.5">
              {CURRENCIES.map((cur) => {
                const active = currency === cur.code;
                return (
                  <button
                    key={cur.code}
                    type="button"
                    onClick={() => setCurrency(cur.code)}
                    className={`py-1.5 px-2 rounded-xl text-xs font-semibold border transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-teal-strong text-white border-teal-strong'
                        : 'bg-cream-soft text-ink-soft border-line hover:bg-beige'
                    }`}
                  >
                    {cur.code} {cur.symbol}
                  </button>
                );
              })}
            </div>

            {/* Big amount input */}
            <div className="flex items-center gap-2 rounded-2xl bg-cream-soft border-2 border-teal-strong/40 px-3 py-2 focus-within:border-teal-strong">
              <span className="font-display text-2xl text-teal-strong whitespace-nowrap">
                {activeCurrencySymbol}
              </span>
              <input
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                placeholder="輸入金額 (例: 1500)"
                aria-label="消費金額"
                className="w-full bg-transparent font-display text-2xl text-ink focus:outline-none"
              />
              {amountStr && (
                <button
                  type="button"
                  onClick={() => setAmountStr('')}
                  className="px-2 py-1 rounded-lg bg-beige text-ink-soft text-meta font-semibold whitespace-nowrap"
                >
                  清除
                </button>
              )}
            </div>

            {/* Quick amount chips */}
            <div className="mt-2 flex items-center gap-1.5 overflow-x-auto">
              {[500, 1000, 3000, 5000].map((inc) => (
                <button
                  key={inc}
                  type="button"
                  onClick={() => setAmountStr(String((Number(amountStr) || 0) + inc))}
                  className="px-2.5 py-1 rounded-xl bg-cream-soft border border-line text-ink-soft text-meta font-semibold hover:bg-mustard-soft hover:text-ink whitespace-nowrap"
                >
                  +{activeCurrencySymbol}{inc.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Store / Merchant Name */}
          <div className="rounded-2xl bg-cream border border-line p-3">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <label className="text-xs font-semibold text-ink-soft whitespace-nowrap">
                2. 店家／消費名稱
              </label>
              {scanned && (
                <span className="px-2 py-0.5 rounded-pill bg-teal-soft text-teal-strong text-meta font-semibold whitespace-nowrap">
                  已標記收據掃描
                </span>
              )}
            </div>
            <input
              type="text"
              value={store}
              onChange={(e) => setStore(e.target.value)}
              placeholder={`例如：${(QUICK_STORES_BY_CATEGORY[category] || [])[0] || '築地 壽司大'}`}
              aria-label="店家或消費名稱"
              className="w-full px-3 py-2 rounded-xl bg-cream-soft border border-line text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-teal"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(QUICK_STORES_BY_CATEGORY[category] || []).map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => setStore(suggestion)}
                  className="px-2.5 py-1 rounded-xl bg-cream-soft border border-line text-ink-soft text-meta hover:bg-beige whitespace-nowrap"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>

          {/* 4. Date (defaulting to selected day) */}
          <div className="rounded-2xl bg-cream border border-line p-3">
            <div className="flex items-center justify-between gap-2 mb-2">
              <label className="text-xs font-semibold text-ink-soft whitespace-nowrap">
                3. 消費日期
              </label>
              <span className="text-meta font-semibold text-teal-strong whitespace-nowrap">
                {dayIdx ? `Day ${dayIdx} · ${trip.days?.[date]?.note || '行程日'}` : date}
              </span>
            </div>

            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              aria-label="消費日期"
              className="w-full px-3 py-2 rounded-xl bg-cream-soft border border-line text-sm text-ink focus:outline-none focus:ring-2 focus:ring-teal"
            />

            {/* Quick trip day pills */}
            <div className="mt-2 flex items-center gap-1.5 overflow-x-auto pb-1">
              {tripDates.map((iso) => {
                const idx = tripDayIndex(trip, iso);
                const selected = iso === date;
                const note = trip.days?.[iso]?.note || '';
                return (
                  <button
                    key={iso}
                    type="button"
                    onClick={() => setDate(iso)}
                    className={`px-2.5 py-1 rounded-xl border text-meta font-semibold transition-colors whitespace-nowrap ${
                      selected
                        ? 'bg-mustard text-ink border-mustard-ink/40'
                        : 'bg-cream-soft text-ink-soft border-line hover:bg-beige'
                    }`}
                  >
                    D{idx} {iso.slice(8)}日 {note}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 5. Category Chips */}
          <div className="rounded-2xl bg-cream border border-line p-3">
            <span className="block text-xs font-semibold text-ink-soft mb-2 whitespace-nowrap">
              4. 分類標籤
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              {MOCK_CATEGORIES.map((cat) => {
                const active = category === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl border text-xs font-semibold transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-teal-strong text-white border-teal-strong'
                        : 'bg-cream-soft text-ink border-line hover:bg-beige'
                    }`}
                  >
                    <CategoryIcon category={cat} className="w-4 h-4 shrink-0" />
                    <span className="whitespace-nowrap">{cat}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 6. Who Paid Chips */}
          <div className="rounded-2xl bg-cream border border-line p-3">
            <span className="block text-xs font-semibold text-ink-soft mb-2 whitespace-nowrap">
              5. 付款／分攤對象
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              {MOCK_PEOPLE.map((person) => {
                const active = assignedTo === person;
                return (
                  <button
                    key={person}
                    type="button"
                    onClick={() => setAssignedTo(person)}
                    className={`py-2 px-2.5 rounded-xl border text-xs font-semibold transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-coral-ink text-white border-coral-ink'
                        : 'bg-cream-soft text-ink border-line hover:bg-beige'
                    }`}
                  >
                    {person === '共同' ? '🤝 共同分攤' : `👤 ${person}`}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 7. Optional Receipt Line Items */}
          <div className="rounded-2xl bg-cream border border-line overflow-hidden">
            <div className="p-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-semibold text-ink-soft whitespace-nowrap">
                  6. 收據品項明細 (選填)
                </span>
                <span className="text-meta text-ink-muted whitespace-nowrap">
                  共 {items.length} 項
                </span>
              </div>

              {items.length > 0 && (
                <ul className="space-y-1.5 mb-2.5">
                  {items.map((item, idx) => (
                    <li
                      key={`${item.name}-${idx}`}
                      className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-cream-soft border border-line text-xs"
                    >
                      <span className="text-ink font-medium whitespace-nowrap">
                        · {item.name}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-ink-soft whitespace-nowrap">
                          {activeCurrencySymbol}{Number(item.price || 0).toLocaleString()}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="px-1.5 py-0.5 rounded bg-coral-soft text-coral-ink text-meta font-semibold whitespace-nowrap"
                        >
                          移除
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="品項名稱 (例: 玉子燒)"
                  className="flex-1 min-w-0 px-2.5 py-1.5 rounded-xl bg-cream-soft border border-line text-xs text-ink placeholder:text-ink-muted focus:outline-none focus:ring-1 focus:ring-teal"
                />
                <input
                  type="number"
                  inputMode="numeric"
                  value={newItemPrice}
                  onChange={(e) => setNewItemPrice(e.target.value)}
                  placeholder="單價"
                  className="w-20 px-2.5 py-1.5 rounded-xl bg-cream-soft border border-line text-xs text-ink placeholder:text-ink-muted focus:outline-none focus:ring-1 focus:ring-teal"
                />
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="px-2.5 py-1.5 rounded-xl bg-teal-soft text-teal-strong text-xs font-semibold hover:bg-beige whitespace-nowrap"
                >
                  + 品項
                </button>
              </div>
            </div>
            <ReceiptZigZagEdge />
          </div>
        </div>

        {/* Sticky Save Footer */}
        <div className="sticky bottom-0 z-10 flex items-center gap-2 px-3.5 py-3 bg-cream-soft border-t-2 border-line">
          {isEditing && onDelete && (
            <button
              type="button"
              onClick={() => onDelete(editingExpense.id)}
              className="px-3.5 py-3 rounded-2xl bg-coral-soft border border-coral-ink/30 text-coral-ink text-xs font-bold hover:bg-coral-ink hover:text-white transition-colors whitespace-nowrap"
            >
              刪除
            </button>
          )}
          <button
            type="submit"
            data-testid="form-save"
            className="flex-1 inline-flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-teal-strong text-white text-sm font-bold hover:bg-ink transition-colors whitespace-nowrap"
          >
            <span className="whitespace-nowrap">
              {isEditing ? '儲存修改' : '儲存消費至手帖'}
            </span>
            <span className="px-2 py-0.5 rounded-pill bg-mustard text-ink text-meta font-bold whitespace-nowrap">
              HK$ {previewHkd.toLocaleString('en-HK', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
}
