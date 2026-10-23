import { useEffect, useState } from 'react';
import { fmtHKD, fmtJPY, personCounts } from '../proto/ref/refLogic';
import {
  addPerson,
  buildReport,
  countRecomputed,
  exportBackupJSON,
  exportTripJSON,
  parseRate,
  removePerson,
  renamePerson,
  setBudget,
  setRate,
} from '../proto/ref/refRules';
import { Sakura, Sparkle, Tape } from '../proto/ref/parts';

function downloadTextFile({ filename, text }) {
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

async function copyTextToClipboard(text) {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to textarea fallback
    }
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return Boolean(ok);
  } catch {
    return false;
  }
}

function formatRateInputString(rate) {
  const n = Number(rate);
  if (!Number.isFinite(n) || n <= 0) return '0.0526';
  const raw = String(n);
  if (raw.length <= 8) return raw;
  return String(Number(n.toPrecision(4)));
}

export default function SettingsView({
  trip,
  trips,
  onUpdateTrip,
  onSelectTrip,
  onSaveBudget,
  onAddPerson,
  onRenamePerson,
  onRemovePerson,
  onSaveRate,
  onToast,
}) {
  const people = trip.settings?.people || ['共同'];
  const currentRate = trip.settings?.rate || 0.0526;
  const currentBudget = trip.settings?.budget ?? null;

  const [editingPerson, setEditingPerson] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [newPerson, setNewPerson] = useState('');
  const [personError, setPersonError] = useState('');
  const [rateInput, setRateInput] = useState(() => formatRateInputString(currentRate));
  const [rateError, setRateError] = useState('');
  const [budgetInput, setBudgetInput] = useState(() => (currentBudget ? String(currentBudget) : ''));

  useEffect(() => {
    setRateInput(formatRateInputString(currentRate));
    setRateError('');
  }, [currentRate, trip.id]);

  useEffect(() => {
    setBudgetInput(currentBudget ? String(currentBudget) : '');
  }, [currentBudget, trip.id]);

  const handleSaveBudget = (e) => {
    if (e) e.preventDefault();
    const nextTrip = setBudget(trip, budgetInput);
    const nextBudget = nextTrip.settings?.budget ?? null;
    if (onSaveBudget) {
      onSaveBudget(nextBudget, nextTrip);
    } else {
      onUpdateTrip?.(nextTrip);
    }
    setBudgetInput(nextBudget ? String(nextBudget) : '');
    if (nextBudget) {
      onToast?.(`已設定預算 ${fmtHKD(nextBudget)}`);
    } else {
      onToast?.('已清除預算');
    }
  };

  const handleClearBudget = () => {
    const nextTrip = setBudget(trip, null);
    if (onSaveBudget) {
      onSaveBudget(null, nextTrip);
    } else {
      onUpdateTrip?.(nextTrip);
    }
    setBudgetInput('');
    onToast?.('已清除預算');
  };

  const totalJPY = trip.expenses
    .filter((e) => (e.currency || e.originalCurrency || 'JPY') === 'JPY')
    .reduce((s, e) => s + Number(e.originalAmount || 0), 0);
  const counts = personCounts(trip.expenses, people);

  const handleRenameSubmit = (from) => {
    const clean = editingName.trim();
    if (!clean) {
      setPersonError('名稱不能為空');
      return;
    }
    if (clean !== from && people.includes(clean)) {
      setPersonError('人物名稱已存在');
      return;
    }
    if (onRenamePerson) {
      const res = onRenamePerson(from, clean);
      if (res && res.ok === false) {
        setPersonError(res.reason === 'exists' ? '人物名稱已存在' : '名稱不能為空');
        return;
      }
    } else {
      const next = renamePerson(trip, from, clean);
      onUpdateTrip?.(next);
    }
    setEditingPerson(null);
    setEditingName('');
    setPersonError('');
    if (clean !== from) onToast?.(`已將「${from}」改名為「${clean}」`);
  };

  const handleAddPerson = (e) => {
    if (e) e.preventDefault();
    const clean = newPerson.trim();
    if (!clean) {
      setPersonError('請輸入人物名稱');
      return;
    }
    if (people.includes(clean)) {
      setPersonError('人物名稱已存在');
      return;
    }
    if (onAddPerson) {
      onAddPerson(clean);
    } else {
      onUpdateTrip?.((t) => addPerson(t, clean));
    }
    setNewPerson('');
    setPersonError('');
    onToast?.(`已新增成員「${clean}」`);
  };

  const handleRemovePerson = (name) => {
    if (name === '共同') return;
    if (onRemovePerson) {
      onRemovePerson(name);
    } else {
      onUpdateTrip?.((t) => removePerson(t, name));
    }
    setPersonError('');
    onToast?.(`已移除「${name}」，其消費已歸入共同`);
  };

  const parsedRate = parseRate(rateInput);
  const isRateInvalid = parsedRate === null;

  const handleSaveRate = (e) => {
    if (e) e.preventDefault();
    const r = parseRate(rateInput);
    if (r === null) {
      setRateError('請輸入大於 0 的匯率');
      return;
    }
    const recomputed = countRecomputed(trip);
    if (onSaveRate) {
      onSaveRate(r);
    } else {
      onUpdateTrip?.((t) => setRate(t, r));
    }
    setRateError('');
    onToast?.(`匯率已更新 · 已重新計算 ${recomputed} 筆`);
  };

  const handleExportTrip = () => {
    const payload = exportTripJSON(trip);
    downloadTextFile(payload);
    onToast?.(`已下載 ${payload.filename}`);
  };

  const handleExportBackup = () => {
    const payload = exportBackupJSON(trips, new Date());
    downloadTextFile(payload);
    onToast?.(`已下載完整備份 ${payload.filename}`);
  };

  const handleCopyReport = async () => {
    const report = buildReport(trip);
    const ok = await copyTextToClipboard(report);
    if (ok) onToast?.('已複製報告');
    else onToast?.('複製報告失敗，請重試');
  };

  return (
    <div data-testid="page-settings" className="space-y-4 px-4 pb-10 pt-4">
      <div className="relative space-y-1">
        <Sparkle className="absolute right-2 top-2 h-4 w-4" />
        <p className="whitespace-nowrap text-meta font-medium tracking-[0.12em] text-ink-muted">旅遊手帳設定</p>
        <div className="flex items-baseline gap-2">
          <h1 className="whitespace-nowrap font-display text-2xl text-ink">設定</h1>
          <span className="whitespace-nowrap font-script text-lg font-bold text-teal-strong">Settings</span>
        </div>
      </div>

      {/* Trip management */}
      <section className="paper-panel relative space-y-2.5 p-4">
        <Tape tone="teal" className="-top-2 left-6 z-10 h-4 w-16 -rotate-1" />
        <div className="flex items-center justify-between">
          <h2 className="whitespace-nowrap font-display text-lg text-ink">旅程管理</h2>
          <span className="whitespace-nowrap rounded-pill bg-teal-soft px-2.5 py-0.5 text-meta font-bold text-teal-strong">
            當前旅程
          </span>
        </div>
        <div className="space-y-2">
          {trips.map((t) => {
            const active = String(t.id) === String(trip.id);
            const tTotal = (t.expenses || []).reduce((s, e) => s + Number(e.hkdAmount || 0), 0);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onSelectTrip(t.id)}
                className={`block min-h-11 w-full rounded-2xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal ${
                  active
                    ? 'border-teal/45 bg-teal-soft/65'
                    : 'border-line bg-cream hover:bg-beige/55'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="whitespace-nowrap text-sm font-bold text-teal-strong">{t.name}</span>
                  <span className="whitespace-nowrap text-meta font-semibold text-teal-strong">
                    {(t.expenses || []).length} 筆記錄
                  </span>
                </div>
                <p className="mt-1 whitespace-nowrap text-meta text-ink-soft">
                  {t.startDate} – {t.endDate} · {fmtHKD(tTotal)}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Trip Budget */}
      <section className="paper-panel space-y-2.5 p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="whitespace-nowrap font-display text-lg text-ink">旅程預算</h2>
          <span className="whitespace-nowrap font-mono text-sm font-bold text-teal-strong">
            {currentBudget ? fmtHKD(currentBudget) : '未設定'}
          </span>
        </div>
        <form
          onSubmit={handleSaveBudget}
          noValidate
          className="flex items-center gap-2 rounded-xl border border-line bg-cream px-3 py-2"
        >
          <span className="shrink-0 whitespace-nowrap font-mono text-meta font-semibold text-ink">HKD</span>
          <input
            id="ref-budget-input"
            data-testid="budget-input"
            aria-label="旅程預算"
            type="text"
            inputMode="numeric"
            value={budgetInput}
            onChange={(e) => setBudgetInput(e.target.value)}
            placeholder="輸入預算金額…"
            className="h-11 min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-white px-2.5 font-mono text-sm font-semibold text-ink placeholder:font-sans placeholder:font-normal placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-teal"
          />
          <button
            type="submit"
            data-testid="budget-save"
            className="inline-flex h-11 min-h-11 min-w-11 shrink-0 items-center justify-center whitespace-nowrap rounded-xl bg-teal-strong px-3 text-meta font-bold text-white shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
          >
            儲存
          </button>
          {currentBudget && (
            <button
              type="button"
              data-testid="budget-clear"
              onClick={handleClearBudget}
              className="inline-flex h-11 min-h-11 min-w-11 shrink-0 items-center justify-center whitespace-nowrap rounded-xl border border-line bg-cream-soft px-3 text-meta font-semibold text-ink-soft hover:bg-beige focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
            >
              清除
            </button>
          )}
        </form>
      </section>

      {/* People / Members */}
      <section className="paper-panel space-y-2.5 p-4">
        <h2 className="whitespace-nowrap font-display text-lg text-ink">人物管理</h2>
        <div className="space-y-2">
          {people.map((p) => {
            const isShared = p === '共同';
            const isEditing = editingPerson === p;
            return (
              <div
                key={p}
                data-testid={`person-row-${p}`}
                className="flex min-h-11 items-center justify-between gap-2 rounded-xl border border-line bg-cream px-3 py-1.5 text-sm"
              >
                {isEditing ? (
                  <div className="flex min-w-0 flex-1 items-center gap-1.5">
                    <input
                      aria-label={`修改 ${p} 名稱`}
                      data-testid={`rename-input-${p}`}
                      value={editingName}
                      onChange={(e) => {
                        setEditingName(e.target.value);
                        setPersonError('');
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleRenameSubmit(p);
                        } else if (e.key === 'Escape') {
                          setEditingPerson(null);
                          setPersonError('');
                        }
                      }}
                      className="h-11 min-h-11 min-w-0 flex-1 rounded-xl border border-teal-strong bg-white px-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-teal"
                    />
                    <button
                      type="button"
                      data-testid={`rename-save-${p}`}
                      onClick={() => handleRenameSubmit(p)}
                      className="inline-flex h-11 min-h-11 min-w-11 shrink-0 items-center justify-center whitespace-nowrap rounded-xl bg-teal-strong px-3 text-meta font-bold text-white"
                    >
                      儲存
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingPerson(null);
                        setPersonError('');
                      }}
                      className="inline-flex h-11 min-h-11 min-w-11 shrink-0 items-center justify-center whitespace-nowrap rounded-xl border border-line bg-cream-soft px-2.5 text-meta font-semibold text-ink-soft"
                    >
                      取消
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="min-w-0 flex-1">
                      <span className="whitespace-nowrap font-semibold text-ink">{p}</span>
                      <span className="ml-2 whitespace-nowrap text-meta font-medium text-ink-muted">
                        {counts[p] || 0} 筆記錄
                      </span>
                    </div>
                    {isShared ? (
                      <span className="whitespace-nowrap rounded-pill bg-beige px-2.5 py-1 text-meta font-semibold text-ink-muted">
                        預設
                      </span>
                    ) : (
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          data-testid={`person-edit-${p}`}
                          aria-label={`改名 ${p}`}
                          onClick={() => {
                            setEditingPerson(p);
                            setEditingName(p);
                            setPersonError('');
                          }}
                          className="inline-flex h-11 min-h-11 min-w-11 items-center justify-center whitespace-nowrap rounded-xl border border-line bg-cream-soft px-2.5 text-meta font-semibold text-ink-soft hover:bg-beige focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
                        >
                          改名
                        </button>
                        <button
                          type="button"
                          data-testid={`person-remove-${p}`}
                          aria-label={`移除 ${p}`}
                          onClick={() => handleRemovePerson(p)}
                          className="inline-flex h-11 min-h-11 min-w-11 items-center justify-center whitespace-nowrap rounded-xl border border-coral-ink/30 bg-coral-soft px-2.5 text-meta font-semibold text-coral-ink hover:bg-coral-ink hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-ink"
                        >
                          移除
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>

        <form onSubmit={handleAddPerson} className="flex items-center gap-2 pt-1">
          <input
            aria-label="新增人物名稱"
            data-testid="add-person-input"
            value={newPerson}
            onChange={(e) => {
              setNewPerson(e.target.value);
              setPersonError('');
            }}
            placeholder="新增成員名稱…"
            className="h-11 min-h-11 min-w-0 flex-1 rounded-2xl border border-line bg-white px-3 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-teal"
          />
          <button
            type="submit"
            data-testid="add-person-btn"
            className="inline-flex h-11 min-h-11 min-w-11 shrink-0 items-center justify-center whitespace-nowrap rounded-2xl bg-teal-strong px-4 text-meta font-bold text-white shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
          >
            ＋新增
          </button>
        </form>
        {personError && (
          <p role="alert" className="whitespace-nowrap text-meta font-semibold text-coral-ink">
            {personError}
          </p>
        )}
      </section>

      {/* Currency & Exchange Rate */}
      <section className="paper-panel space-y-2.5 p-4">
        <h2 className="whitespace-nowrap font-display text-lg text-ink">貨幣與匯率</h2>
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-xl border border-line bg-cream p-2.5">
            <p className="whitespace-nowrap text-meta text-ink-muted">旅程主要外幣</p>
            <p className="mt-0.5 whitespace-nowrap text-sm font-bold text-ink">JPY 日元</p>
          </div>
          <div className="rounded-xl border border-line bg-cream p-2.5">
            <p className="whitespace-nowrap text-meta text-ink-muted">記帳貨幣</p>
            <p className="mt-0.5 whitespace-nowrap text-sm font-bold text-ink">HKD 港幣</p>
          </div>
        </div>
        <form onSubmit={handleSaveRate} noValidate className="space-y-1.5">
          <div className="flex items-center gap-2 rounded-xl border border-line bg-cream px-3 py-2">
            <label htmlFor="ref-rate-input" className="shrink-0 whitespace-nowrap font-mono text-meta font-semibold text-ink">
              1 JPY =
            </label>
            <input
              id="ref-rate-input"
              data-testid="rate-input"
              aria-label="匯率"
              type="text"
              inputMode="decimal"
              value={rateInput}
              onChange={(e) => {
                const nextVal = e.target.value;
                setRateInput(nextVal);
                setRateError(parseRate(nextVal) === null ? '請輸入大於 0 的匯率' : '');
              }}
              className="h-11 min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-white px-2.5 font-mono text-sm font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-teal"
            />
            <span className="shrink-0 whitespace-nowrap font-mono text-meta font-semibold text-ink">HKD</span>
            <button
              type="submit"
              data-testid="rate-save"
              disabled={isRateInvalid}
              className="inline-flex h-11 min-h-11 min-w-11 shrink-0 items-center justify-center whitespace-nowrap rounded-xl bg-teal-strong px-3 text-meta font-bold text-white shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal disabled:pointer-events-none disabled:opacity-50"
            >
              更新匯率
            </button>
          </div>
          {(isRateInvalid || rateError) && (
            <p role="alert" data-testid="rate-error" className="whitespace-nowrap text-meta font-semibold text-coral-ink">
              {rateError || '請輸入大於 0 的匯率'}
            </p>
          )}
        </form>
      </section>

      {/* Data & Export */}
      <section className="paper-panel space-y-2.5 p-4">
        <h2 className="whitespace-nowrap font-display text-lg text-ink">資料管理</h2>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            data-testid="export-json"
            onClick={handleExportTrip}
            className="inline-flex min-h-11 min-w-11 items-center justify-center whitespace-nowrap rounded-xl border border-line bg-cream px-2 py-2.5 text-meta font-semibold text-ink-soft hover:bg-beige focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
          >
            匯出 JSON
          </button>
          <button
            type="button"
            data-testid="export-backup"
            onClick={handleExportBackup}
            className="inline-flex min-h-11 min-w-11 items-center justify-center whitespace-nowrap rounded-xl border border-line bg-cream px-2 py-2.5 text-meta font-semibold text-ink-soft hover:bg-beige focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
          >
            完整備份
          </button>
          <button
            type="button"
            data-testid="copy-report"
            onClick={handleCopyReport}
            className="inline-flex min-h-11 min-w-11 items-center justify-center whitespace-nowrap rounded-xl border border-line bg-cream px-2 py-2.5 text-meta font-semibold text-ink-soft hover:bg-beige focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
          >
            複製報告
          </button>
        </div>
      </section>

      {/* About */}
      <section className="paper-panel relative space-y-1 p-4">
        <Sakura className="absolute right-3 top-3 h-6 w-6 opacity-70" />
        <h2 className="whitespace-nowrap font-display text-base text-ink">關於旅遊手帳</h2>
        <p className="whitespace-nowrap text-meta text-ink-soft">
          原幣合計 {fmtJPY(totalJPY)} · 旅遊手帳模式
        </p>
      </section>
    </div>
  );
}
