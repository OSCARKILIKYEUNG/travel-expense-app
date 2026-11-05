import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { WashiLabel } from '../journal/art/decor.jsx';
import { fmtHKD, fmtJPY, personCounts } from '../proto/ref/refLogic';
import {
  addPerson,
  buildReport,
  countRecomputed,
  exportBackupJSON,
  exportTripJSON,
  isValidISODate,
  parseRate,
  removePerson,
  renamePerson,
  resolveToday,
  setBudget,
  setRate,
  setTripDates,
} from '../proto/ref/refRules';
import { CURRENCY_NAMES } from '../utils/constants';
import { normalizeDate } from '../utils/duplicates';
import { normalizeUiLanguage } from '../utils/locale';
import { tripCurrencyOptions } from '../utils/tripMoney';
import { DEFAULT_REF_RATE } from './tripRate';

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

/**
 * Apply a UI language change either through the persisted settings callback
 * (`onChangeUiLanguage` / `updateSettings` in authenticated `NotebookShell`)
 * or locally via `i18n.changeLanguage` for `?proto=notebook` preview.
 *
 * @param {unknown} rawValue
 * @param {{
 *   onChangeUiLanguage?: (lang: 'zh-TW' | 'en') => void,
 *   updateSettings?: (patch: { uiLanguage: 'zh-TW' | 'en' }) => void,
 *   i18nInstance?: { changeLanguage?: (lang: string) => any },
 * }} [options]
 * @returns {'zh-TW' | 'en'}
 */
export function applyNotebookLanguageChange(
  rawValue,
  { onChangeUiLanguage, updateSettings, i18nInstance = i18n } = {},
) {
  const normalized = normalizeUiLanguage(rawValue);
  if (typeof onChangeUiLanguage === 'function') {
    onChangeUiLanguage(normalized);
  } else if (typeof updateSettings === 'function') {
    updateSettings({ uiLanguage: normalized });
  } else {
    i18nInstance?.changeLanguage?.(normalized);
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.lang = normalized === 'en' ? 'en' : 'zh-Hant';
    }
  }
  return normalized;
}

/**
 * Validate and apply trip start/end date changes either through the controlled
 * `onSaveDates` callback (`NotebookShell` -> `updateTrip`) or via `onUpdateTrip`
 * for `?proto=notebook` mock trips.
 *
 * @param {Record<string, any>} trip
 * @param {{ startDate?: unknown, endDate?: unknown }} [input]
 * @param {{
 *   onSaveDates?: (patch: { startDate: string, endDate: string | null }, nextTrip: Record<string, any>) => any,
 *   onUpdateTrip?: (nextTripOrUpdater: any) => void,
 *   onToast?: (msg: string) => void,
 *   t?: (key: string, opts?: Record<string, any>) => string,
 * }} [options]
 */
export function applyNotebookTripDates(
  trip,
  { startDate, endDate } = {},
  { onSaveDates, onUpdateTrip, onToast, t } = {},
) {
  const res = setTripDates(trip, startDate, endDate);
  if (!res.ok) {
    return res;
  }
  if (typeof onSaveDates === 'function') {
    onSaveDates({ startDate: res.startDate, endDate: res.endDate }, res.trip);
  } else if (typeof onUpdateTrip === 'function') {
    onUpdateTrip(res.trip);
  }
  if (typeof onToast === 'function') {
    const displayEnd = res.endDate || res.startDate;
    const msg =
      typeof t === 'function'
        ? t('notebook.toast.datesSaved', { startDate: res.startDate, endDate: displayEnd })
        : `${res.startDate} – ${displayEnd}`;
    onToast(msg);
  }
  return res;
}

/**
 * Validate and normalize new-trip form fields for notebook Settings.
 * - Rejects empty/whitespace `name` with `{ ok: false, errorKey: 'trip.enterName' }`.
 * - Normalizes `startDate` to a valid ISO `YYYY-MM-DD` (defaulting to `today` / local today).
 * - Normalizes `tripCurrency` (or `currency`) to a 3-letter uppercase ISO code (defaulting to `'JPY'`).
 *
 * @param {{ name?: unknown, startDate?: unknown, tripCurrency?: unknown, currency?: unknown }} [input]
 * @param {{ today?: string }} [options]
 */
export function validateNewTrip(
  { name, startDate, tripCurrency, currency } = {},
  { today } = {},
) {
  const cleanName =
    typeof name === 'string' || typeof name === 'number' ? String(name).trim() : '';
  const fallbackToday = isValidISODate(today) ? today : resolveToday('');
  const rawStart = typeof startDate === 'string' ? startDate.trim() : '';
  let resolvedStart = fallbackToday;
  if (rawStart) {
    if (isValidISODate(rawStart)) {
      resolvedStart = rawStart;
    } else {
      const norm = normalizeDate(rawStart);
      if (norm && isValidISODate(norm)) {
        resolvedStart = norm;
      }
    }
  }

  const rawCurrency = tripCurrency !== undefined ? tripCurrency : currency;
  const rawCurStr =
    typeof rawCurrency === 'string' ? rawCurrency.trim().toUpperCase() : '';
  const resolvedCurrency = /^[A-Z]{3}$/.test(rawCurStr) ? rawCurStr : 'JPY';

  if (!cleanName) {
    return {
      ok: false,
      errorKey: 'trip.enterName',
      name: '',
      startDate: resolvedStart,
      tripCurrency: resolvedCurrency,
      currency: resolvedCurrency,
    };
  }

  return {
    ok: true,
    errorKey: null,
    name: cleanName,
    startDate: resolvedStart,
    tripCurrency: resolvedCurrency,
    currency: resolvedCurrency,
  };
}

/**
 * Build a mock trip object compatible with `buildInitialMockTrips` in `NotebookApp`.
 *
 * @param {{ name?: unknown, startDate?: unknown, tripCurrency?: unknown, currency?: unknown, id?: string, rate?: number, people?: string[], today?: string }} [input]
 * @param {{ today?: string, rate?: number, people?: string[], id?: string, now?: number }} [options]
 */
export function buildMockTrip(
  input = {},
  { today, rate, people, id, now = Date.now() } = {},
) {
  const validated = validateNewTrip(input, { today: today ?? input?.today });
  const resolvedName = validated.name || '新旅程';
  const resolvedStart = validated.startDate;
  const resolvedCurrency = validated.tripCurrency;
  const resolvedRate =
    parseRate(rate ?? input?.rate) ??
    (resolvedCurrency === 'HKD' ? 1 : DEFAULT_REF_RATE);
  const resolvedPeople =
    Array.isArray(people) && people.length > 0
      ? [...people]
      : Array.isArray(input?.people) && input.people.length > 0
        ? [...input.people]
        : ['共同'];
  const ts = typeof now === 'number' && Number.isFinite(now) ? now : Date.now();
  const resolvedId = id ?? input?.id ?? `trip-${ts}`;

  return {
    id: resolvedId,
    name: resolvedName,
    startDate: resolvedStart,
    endDate: resolvedStart,
    tripCurrency: resolvedCurrency,
    currency: resolvedCurrency,
    accountingCurrency: 'HKD',
    days: {},
    expenses: [],
    settings: {
      people: resolvedPeople,
      rate: resolvedRate,
      budget: null,
    },
  };
}

/**
 * Validate and submit a new trip from notebook Settings, firing `onCreateTrip` and `onToast`.
 */
export function applyNotebookCreateTrip(
  input = {},
  { onCreateTrip, onToast, t, today } = {},
) {
  const res = validateNewTrip(input, { today });
  if (!res.ok) {
    return res;
  }
  const created =
    typeof onCreateTrip === 'function'
      ? onCreateTrip({
          name: res.name,
          startDate: res.startDate,
          tripCurrency: res.tripCurrency,
        })
      : null;
  if (typeof onToast === 'function') {
    const msg = typeof t === 'function' ? t('toast.tripCreated') : '旅程已創建';
    onToast(msg);
  }
  return {
    ...res,
    trip: created,
  };
}

/**
 * Execute sign-out from notebook Settings, toggling `setSigningOut(true)` while
 * pending and re-enabling + firing `onToast(t('notebook.settings.signOutFailed'))`
 * if `onSignOut` throws or rejects.
 */
export async function applyNotebookSignOut({
  onSignOut,
  onToast,
  t,
  setSigningOut,
} = {}) {
  setSigningOut?.(true);
  try {
    const res = await onSignOut?.();
    if (res?.error) {
      throw res.error;
    }
    return { ok: true };
  } catch (error) {
    if (typeof onToast === 'function') {
      const msg =
        typeof t === 'function'
          ? t('notebook.settings.signOutFailed')
          : 'Sign-out failed. Please try again.';
      onToast(msg);
    }
    return { ok: false, error };
  } finally {
    setSigningOut?.(false);
  }
}

export default function SettingsView({
  trip,
  trips,
  today: propToday,
  onUpdateTrip,
  onSelectTrip,
  onCreateTrip,
  onSaveDates,
  onSaveBudget,
  onAddPerson,
  onRenamePerson,
  onRemovePerson,
  onSaveRate,
  onToast,
  uiLanguage: propUiLanguage,
  onChangeUiLanguage,
  updateSettings,
  account = null,
  onSignOut,
  initialSigningOut = false,
  initialShowAddTrip = false,
}) {
  const { t, i18n: activeI18n } = useTranslation();
  const resolvedUiLanguage = normalizeUiLanguage(propUiLanguage ?? activeI18n.language);
  const defaultStartDate = useMemo(
    () => (isValidISODate(propToday) ? propToday : resolveToday('')),
    [propToday],
  );
  const currencyOptions = useMemo(() => tripCurrencyOptions(trip), [trip]);

  const people = trip.settings?.people || ['共同'];
  const currentRate = trip.settings?.rate || 0.0526;
  const currentBudget = trip.settings?.budget ?? null;

  const [showAddTrip, setShowAddTrip] = useState(() => Boolean(initialShowAddTrip));
  const [signingOut, setSigningOut] = useState(() => Boolean(initialSigningOut));
  const [newTripName, setNewTripName] = useState('');
  const [newTripStart, setNewTripStart] = useState(() => defaultStartDate);
  const [newTripCurrency, setNewTripCurrency] = useState('JPY');
  const [newTripErrorKey, setNewTripErrorKey] = useState('');
  const [editingPerson, setEditingPerson] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [newPerson, setNewPerson] = useState('');
  const [personErrorKey, setPersonErrorKey] = useState('');
  const [rateInput, setRateInput] = useState(() => formatRateInputString(currentRate));
  const [rateErrorKey, setRateErrorKey] = useState('');
  const [budgetInput, setBudgetInput] = useState(() => (currentBudget ? String(currentBudget) : ''));
  const [startDateInput, setStartDateInput] = useState(() => trip.startDate || '');
  const [endDateInput, setEndDateInput] = useState(() => trip.endDate || '');
  const [datesErrorKey, setDatesErrorKey] = useState('');

  useEffect(() => {
    setRateInput(formatRateInputString(currentRate));
    setRateErrorKey('');
  }, [currentRate, trip.id]);

  useEffect(() => {
    setBudgetInput(currentBudget ? String(currentBudget) : '');
  }, [currentBudget, trip.id]);

  useEffect(() => {
    setStartDateInput(trip.startDate || '');
    setEndDateInput(trip.endDate || '');
    setDatesErrorKey('');
  }, [trip.startDate, trip.endDate, trip.id]);

  const handleLanguageChange = (e) => {
    applyNotebookLanguageChange(e.target.value, {
      onChangeUiLanguage,
      updateSettings,
      i18nInstance: activeI18n,
    });
  };

  const handleSignOut = async () => {
    if (signingOut) return;
    await applyNotebookSignOut({
      onSignOut,
      onToast,
      t,
      setSigningOut,
    });
  };

  const handleOpenAddTrip = () => {
    setShowAddTrip(true);
    setNewTripName('');
    setNewTripStart(defaultStartDate);
    setNewTripCurrency('JPY');
    setNewTripErrorKey('');
  };

  const handleCancelAddTrip = () => {
    setShowAddTrip(false);
    setNewTripName('');
    setNewTripStart(defaultStartDate);
    setNewTripCurrency('JPY');
    setNewTripErrorKey('');
  };

  const handleCreateTripSubmit = (e) => {
    if (e) e.preventDefault();
    const res = applyNotebookCreateTrip(
      {
        name: newTripName,
        startDate: newTripStart,
        tripCurrency: newTripCurrency,
      },
      { onCreateTrip, onToast, t, today: defaultStartDate },
    );
    if (!res.ok) {
      setNewTripErrorKey(res.errorKey || 'trip.enterName');
      return;
    }
    setShowAddTrip(false);
    setNewTripName('');
    setNewTripStart(defaultStartDate);
    setNewTripCurrency('JPY');
    setNewTripErrorKey('');
  };

  const handleSaveDates = (e) => {
    if (e) e.preventDefault();
    const res = applyNotebookTripDates(
      trip,
      { startDate: startDateInput, endDate: endDateInput },
      { onSaveDates, onUpdateTrip, onToast, t },
    );
    if (!res.ok) {
      setDatesErrorKey(res.errorKey || 'notebook.settings.datesInvalid');
      return;
    }
    setDatesErrorKey('');
    setStartDateInput(res.startDate);
    setEndDateInput(res.endDate || '');
  };

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
      onToast?.(t('notebook.toast.budgetSaved', { amount: fmtHKD(nextBudget) }));
    } else {
      onToast?.(t('notebook.toast.budgetCleared'));
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
    onToast?.(t('notebook.toast.budgetCleared'));
  };

  const totalJPY = trip.expenses
    .filter((e) => (e.currency || e.originalCurrency || 'JPY') === 'JPY')
    .reduce((s, e) => s + Number(e.originalAmount || 0), 0);
  const counts = personCounts(trip.expenses, people);

  const handleRenameSubmit = (from) => {
    const clean = editingName.trim();
    if (!clean) {
      setPersonErrorKey('notebook.settings.personNameEmpty');
      return;
    }
    if (clean !== from && people.includes(clean)) {
      setPersonErrorKey('notebook.settings.personExists');
      return;
    }
    if (onRenamePerson) {
      const res = onRenamePerson(from, clean);
      if (res && res.ok === false) {
        setPersonErrorKey(
          res.reason === 'exists'
            ? 'notebook.settings.personExists'
            : 'notebook.settings.personNameEmpty',
        );
        return;
      }
    } else {
      const next = renamePerson(trip, from, clean);
      onUpdateTrip?.(next);
    }
    setEditingPerson(null);
    setEditingName('');
    setPersonErrorKey('');
    if (clean !== from) {
      onToast?.(t('notebook.toast.personRenamed', { from, to: clean }));
    }
  };

  const handleAddPerson = (e) => {
    if (e) e.preventDefault();
    const clean = newPerson.trim();
    if (!clean) {
      setPersonErrorKey('notebook.settings.enterPersonName');
      return;
    }
    if (people.includes(clean)) {
      setPersonErrorKey('notebook.settings.personExists');
      return;
    }
    if (onAddPerson) {
      onAddPerson(clean);
    } else {
      onUpdateTrip?.((tr) => addPerson(tr, clean));
    }
    setNewPerson('');
    setPersonErrorKey('');
    onToast?.(t('notebook.toast.personAdded', { name: clean }));
  };

  const handleRemovePerson = (name) => {
    if (name === '共同') return;
    let dropped = 0;
    if (onRemovePerson) {
      const res = onRemovePerson(name);
      dropped = Number(res?.droppedSettlements) || 0;
    } else {
      const next = removePerson(trip, name);
      dropped = Number(next?.droppedSettlements) || 0;
      onUpdateTrip?.(next);
    }
    setPersonErrorKey('');
    const baseMsg = t('notebook.toast.personRemoved', { name });
    const suffix = dropped > 0 ? t('notebook.settle.droppedRepayments', { count: dropped }) : '';
    onToast?.(`${baseMsg}${suffix}`);
  };

  const parsedRate = parseRate(rateInput);
  const isRateInvalid = parsedRate === null;

  const handleSaveRate = (e) => {
    if (e) e.preventDefault();
    const r = parseRate(rateInput);
    if (r === null) {
      setRateErrorKey('notebook.settings.rateInvalid');
      return;
    }
    const recomputed = countRecomputed(trip);
    if (onSaveRate) {
      onSaveRate(r);
    } else {
      onUpdateTrip?.((tr) => setRate(tr, r));
    }
    setRateErrorKey('');
    onToast?.(t('notebook.toast.rateUpdated', { count: recomputed }));
  };

  const handleExportTrip = () => {
    const payload = exportTripJSON(trip);
    downloadTextFile(payload);
    onToast?.(t('notebook.toast.exportedTrip', { filename: payload.filename }));
  };

  const handleExportBackup = () => {
    const payload = exportBackupJSON(trips, new Date());
    downloadTextFile(payload);
    onToast?.(t('notebook.toast.exportedBackup', { filename: payload.filename }));
  };

  const handleCopyReport = async () => {
    const report = buildReport(trip);
    const ok = await copyTextToClipboard(report);
    if (ok) onToast?.(t('notebook.toast.reportCopied'));
    else onToast?.(t('notebook.toast.reportCopyFailed'));
  };

  const settingsTitle = t('settings.title');
  const settingsTitleScript = t('notebook.settings.titleScript');
  const showSettingsTitleScript = Boolean(settingsTitleScript) && settingsTitleScript !== settingsTitle;

  const sectionCardClass = 'jr-taped-card jr-grid space-y-2.5 border border-ink-soft/40 p-4';
  const subPanelClass = 'rounded-sm border border-ink-soft/40 bg-paper p-3';
  const inputFieldClass =
    'h-11 min-h-11 rounded-sm border border-ink-soft bg-paper px-3 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-route focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route';
  const selectFieldClass =
    'h-11 min-h-11 rounded-sm border border-ink-soft bg-paper px-3 text-sm font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-route focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route';
  const primaryBtnClass =
    'jr-btn-navy inline-flex h-11 min-h-11 min-w-11 shrink-0 items-center justify-center whitespace-nowrap rounded-sm px-3.5 font-hand text-sm font-bold text-paper transition-opacity hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route disabled:pointer-events-none disabled:opacity-50';
  const secondaryBtnClass =
    'jr-btn-paper inline-flex h-11 min-h-11 min-w-11 shrink-0 items-center justify-center whitespace-nowrap rounded-sm px-3 text-sm font-semibold text-ink transition-colors hover:bg-paper-shade focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route';

  return (
    <div data-testid="page-settings" className="space-y-4 px-4 pb-10 pt-4 lg:mx-auto lg:max-w-2xl">
      <div className="relative space-y-1">
        <p className="whitespace-nowrap font-hand text-[15px] lg:text-base font-semibold uppercase tracking-[0.08em] text-ink-soft">
          {t('settings.pageEyebrow')}
        </p>
        <div className="flex items-baseline gap-2">
          <h1 className="whitespace-nowrap font-hand text-2xl text-ink">{settingsTitle}</h1>
          {showSettingsTitleScript && (
            <span className="whitespace-nowrap font-serif-display text-[15px] lg:text-base font-semibold uppercase tracking-[0.08em] text-route">
              {settingsTitleScript}
            </span>
          )}
        </div>
      </div>

      {/* Account */}
      {account?.email && (
        <section data-testid="account-card" className={sectionCardClass}>
          <WashiLabel tone="kraft" tilt={-1}>
            <h2 className="whitespace-nowrap font-hand text-xs font-bold tracking-widest text-kraft-ink">
              {t('notebook.settings.accountTitle')}
            </h2>
          </WashiLabel>

          <div className="flex items-baseline justify-between gap-3">
            <span className="shrink-0 whitespace-nowrap font-hand text-meta font-medium text-ink-soft">
              {t('notebook.settings.accountEmail')}
            </span>
            <span
              data-testid="account-email"
              className="min-w-0 break-all text-right text-sm font-semibold text-ink"
            >
              {account.email}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="shrink-0 whitespace-nowrap font-hand text-meta font-medium text-ink-soft">
              {t('settings.billingPlanLabel')}
            </span>
            {account.plan === 'pro' ? (
              <span
                data-testid="account-plan"
                className="whitespace-nowrap rounded-sm border border-ink-soft bg-tape-navy px-2.5 py-0.5 font-hand text-meta font-bold text-paper"
              >
                {t('settings.planPro')}
              </span>
            ) : account.plan === 'free' ? (
              <span
                data-testid="account-plan"
                className="whitespace-nowrap rounded-sm border border-ink-soft/45 bg-paper px-2.5 py-0.5 font-hand text-meta font-semibold text-ink-soft"
              >
                {t('settings.planFree')}
              </span>
            ) : (
              <span
                data-testid="account-plan"
                className="whitespace-nowrap text-meta font-medium text-ink-soft"
              >
                {t('notebook.settings.accountPlanLoading')}
              </span>
            )}
          </div>

          {account.plan === 'free' && (
            <p
              data-testid="account-scans"
              className={`text-meta font-medium ${
                (account.remainingFreeScans ?? 0) <= 0
                  ? 'font-semibold text-coral-ink'
                  : 'text-ink-soft'
              }`}
            >
              {t('upload.freeQuota', {
                remaining: account.remainingFreeScans ?? 0,
                limit: account.freeScanLimit ?? 0,
              })}
            </p>
          )}

          <button
            type="button"
            data-testid="account-signout"
            disabled={signingOut}
            onClick={handleSignOut}
            className="inline-flex h-11 min-h-11 w-full items-center justify-center whitespace-nowrap rounded-sm border border-coral-ink/35 bg-coral-soft px-4 text-sm font-semibold text-coral-ink transition-colors hover:bg-coral-ink hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-ink disabled:pointer-events-none disabled:opacity-50"
          >
            {signingOut ? t('notebook.settings.signingOut') : t('settings.signOut')}
          </button>
        </section>
      )}

      {/* UI Language */}
      <section className={sectionCardClass}>
        <label
          htmlFor="notebook-language-select"
          className="block whitespace-nowrap font-hand text-lg text-ink"
        >
          <WashiLabel tone="kraft" tilt={-1}>
            {t('settings.language')}
          </WashiLabel>
        </label>
        <select
          id="notebook-language-select"
          data-testid="language-select"
          aria-label={t('settings.language')}
          value={resolvedUiLanguage}
          onChange={handleLanguageChange}
          className={`${selectFieldClass} w-full`}
        >
          <option value="zh-TW">{t('settings.languageZhTW')}</option>
          <option value="en">{t('settings.languageEn')}</option>
        </select>
      </section>

      {/* Trip management */}
      <section className={`relative ${sectionCardClass}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <WashiLabel tone="navy" tilt={-1}>
              <h2 className="whitespace-nowrap font-hand text-xs font-bold tracking-widest text-paper">
                {t('settings.tripsTitle')}
              </h2>
            </WashiLabel>
            <span className="whitespace-nowrap rounded-sm border border-route/35 bg-route-soft px-2 py-0.5 font-hand text-meta font-bold text-route">
              {t('notebook.settings.currentTripBadge')}
            </span>
          </div>
          <button
            type="button"
            data-testid="add-trip-btn"
            aria-expanded={showAddTrip}
            onClick={handleOpenAddTrip}
            className={primaryBtnClass}
          >
            {t('trip.addTrip')}
          </button>
        </div>

        {showAddTrip && (
          <form
            data-testid="add-trip-form"
            onSubmit={handleCreateTripSubmit}
            noValidate
            className={`space-y-2.5 ${subPanelClass}`}
          >
            <div>
              <label
                htmlFor="notebook-new-trip-name"
                className="mb-1 block whitespace-nowrap font-hand text-meta font-medium text-ink-muted"
              >
                {t('trip.tripName')}
              </label>
              <input
                id="notebook-new-trip-name"
                data-testid="new-trip-name"
                aria-label={t('trip.tripName')}
                type="text"
                value={newTripName}
                onChange={(e) => {
                  setNewTripName(e.target.value);
                  setNewTripErrorKey('');
                }}
                placeholder={t('trip.tripNamePlaceholder')}
                autoComplete="off"
                className={`${inputFieldClass} w-full`}
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label
                  htmlFor="notebook-new-trip-start"
                  className="mb-1 block whitespace-nowrap font-hand text-meta font-medium text-ink-muted"
                >
                  {t('trip.startDate')}
                </label>
                <input
                  id="notebook-new-trip-start"
                  data-testid="new-trip-start"
                  aria-label={t('trip.startDate')}
                  type="date"
                  value={newTripStart}
                  onChange={(e) => setNewTripStart(e.target.value)}
                  className={`${inputFieldClass} w-full px-2.5 font-mono font-semibold`}
                />
              </div>

              <div>
                <label
                  htmlFor="notebook-new-trip-currency"
                  className="mb-1 block whitespace-nowrap font-hand text-meta font-medium text-ink-muted"
                >
                  {t('trip.tripCurrency')}
                </label>
                <select
                  id="notebook-new-trip-currency"
                  data-testid="new-trip-currency"
                  aria-label={t('trip.tripCurrency')}
                  value={newTripCurrency}
                  onChange={(e) => setNewTripCurrency(e.target.value)}
                  className={`${selectFieldClass} w-full px-2.5`}
                >
                  {currencyOptions.map((code) => {
                    const label = CURRENCY_NAMES[code] ? t(`currency.${code}`) : code;
                    return (
                      <option key={code} value={code}>
                        {label && label !== code ? `${code} — ${label}` : code}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            {newTripErrorKey && (
              <p
                role="alert"
                data-testid="new-trip-error"
                className="whitespace-nowrap text-meta font-semibold text-coral-ink"
              >
                {t(newTripErrorKey)}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                data-testid="new-trip-cancel"
                onClick={handleCancelAddTrip}
                className={secondaryBtnClass}
              >
                {t('settings.cancel')}
              </button>
              <button
                type="submit"
                data-testid="new-trip-submit"
                className={`${primaryBtnClass} px-4`}
              >
                {t('trip.create')}
              </button>
            </div>
          </form>
        )}

        <div className="space-y-2">
          {trips.map((tr) => {
            const active = String(tr.id) === String(trip.id);
            const tTotal = (tr.expenses || []).reduce((s, e) => s + Number(e.hkdAmount || 0), 0);
            return (
              <button
                key={tr.id}
                type="button"
                aria-current={active ? 'true' : undefined}
                onClick={() => onSelectTrip(tr.id)}
                className={`block min-h-11 w-full rounded-sm border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route ${
                  active
                    ? 'border-tape-navy bg-route-soft/65 ring-1 ring-tape-navy'
                    : 'border-ink-soft/40 bg-paper hover:bg-paper-shade/65'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="whitespace-nowrap font-hand text-sm font-bold text-route">{tr.name}</span>
                  <span className="whitespace-nowrap text-meta font-semibold text-route">
                    {t('trip.records', { count: (tr.expenses || []).length })}
                  </span>
                </div>
                <p className="mt-1 whitespace-nowrap text-meta text-ink-soft">
                  {tr.startDate} – {tr.endDate} · {fmtHKD(tTotal)}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Trip Dates */}
      <section className={sectionCardClass}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <WashiLabel tone="kraft" tilt={-1}>
            <h2 className="whitespace-nowrap font-hand text-xs font-bold tracking-widest text-kraft-ink">
              {t('notebook.settings.datesTitle')}
            </h2>
          </WashiLabel>
          <span className="whitespace-nowrap font-mono text-meta font-semibold text-route">
            {trip.startDate} – {trip.endDate}
          </span>
        </div>
        <form
          onSubmit={handleSaveDates}
          noValidate
          className={`space-y-2.5 ${subPanelClass}`}
        >
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label
                htmlFor="ref-trip-start-date"
                className="mb-1 block whitespace-nowrap font-hand text-meta font-medium text-ink-muted"
              >
                {t('notebook.settings.startDateLabel')}
              </label>
              <input
                id="ref-trip-start-date"
                data-testid="trip-start-date"
                aria-label={t('notebook.settings.startDateLabel')}
                type="text"
                inputMode="numeric"
                value={startDateInput}
                onChange={(e) => {
                  setStartDateInput(e.target.value);
                  setDatesErrorKey('');
                }}
                placeholder={t('notebook.settings.startDatePlaceholder')}
                className={`${inputFieldClass} w-full px-2.5 font-mono font-semibold placeholder:font-sans placeholder:font-normal`}
              />
            </div>
            <div>
              <label
                htmlFor="ref-trip-end-date"
                className="mb-1 block whitespace-nowrap font-hand text-meta font-medium text-ink-muted"
              >
                {t('notebook.settings.endDateLabel')}
              </label>
              <input
                id="ref-trip-end-date"
                data-testid="trip-end-date"
                aria-label={t('notebook.settings.endDateLabel')}
                type="text"
                inputMode="numeric"
                value={endDateInput}
                onChange={(e) => {
                  setEndDateInput(e.target.value);
                  setDatesErrorKey('');
                }}
                placeholder={t('notebook.settings.endDatePlaceholder')}
                className={`${inputFieldClass} w-full px-2.5 font-mono font-semibold placeholder:font-sans placeholder:font-normal`}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              data-testid="trip-dates-save"
              className={`${primaryBtnClass} px-4`}
            >
              {t('notebook.settings.saveDates')}
            </button>
          </div>
          {datesErrorKey && (
            <p
              role="alert"
              data-testid="trip-dates-error"
              className="whitespace-nowrap text-meta font-semibold text-coral-ink"
            >
              {t(datesErrorKey)}
            </p>
          )}
        </form>
      </section>

      {/* Trip Budget */}
      <section className={sectionCardClass}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <WashiLabel tone="kraft" tilt={-1}>
            <h2 className="whitespace-nowrap font-hand text-xs font-bold tracking-widest text-kraft-ink">
              {t('notebook.settings.budgetTitle')}
            </h2>
          </WashiLabel>
          <span className="whitespace-nowrap font-mono text-sm font-bold text-route">
            {currentBudget ? fmtHKD(currentBudget) : t('notebook.settings.budgetUnset')}
          </span>
        </div>
        <form
          onSubmit={handleSaveBudget}
          noValidate
          className="flex items-center gap-2 rounded-sm border border-ink-soft/40 bg-paper px-3 py-2"
        >
          <span className="shrink-0 whitespace-nowrap font-mono text-meta font-semibold text-ink">HKD</span>
          <input
            id="ref-budget-input"
            data-testid="budget-input"
            aria-label={t('notebook.settings.budgetTitle')}
            type="text"
            inputMode="numeric"
            value={budgetInput}
            onChange={(e) => setBudgetInput(e.target.value)}
            placeholder={t('notebook.settings.budgetPlaceholder')}
            className={`${inputFieldClass} min-w-0 flex-1 px-2.5 font-mono font-semibold placeholder:font-sans placeholder:font-normal`}
          />
          <button
            type="submit"
            data-testid="budget-save"
            className={`${primaryBtnClass} px-3`}
          >
            {t('notebook.settings.save')}
          </button>
          {currentBudget && (
            <button
              type="button"
              data-testid="budget-clear"
              onClick={handleClearBudget}
              className={secondaryBtnClass}
            >
              {t('notebook.settings.clear')}
            </button>
          )}
        </form>
      </section>

      {/* People / Members */}
      <section className={sectionCardClass}>
        <WashiLabel tone="kraft" tilt={-1}>
          <h2 className="whitespace-nowrap font-hand text-xs font-bold tracking-widest text-kraft-ink">
            {t('settings.peopleTitle')}
          </h2>
        </WashiLabel>
        <div className="space-y-2">
          {people.map((p) => {
            const isShared = p === '共同';
            const displayPersonName = isShared ? t('expenseCard.shared') : p;
            const isEditing = editingPerson === p;
            return (
              <div
                key={p}
                data-testid={`person-row-${p}`}
                className="flex min-h-11 items-center justify-between gap-2 rounded-sm border border-ink-soft/40 bg-paper px-3 py-1.5 text-sm"
              >
                {isEditing ? (
                  <div className="flex min-w-0 flex-1 items-center gap-1.5">
                    <input
                      aria-label={t('notebook.settings.renamePersonInputAria', { name: displayPersonName })}
                      data-testid={`rename-input-${p}`}
                      value={editingName}
                      onChange={(e) => {
                        setEditingName(e.target.value);
                        setPersonErrorKey('');
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleRenameSubmit(p);
                        } else if (e.key === 'Escape') {
                          setEditingPerson(null);
                          setPersonErrorKey('');
                        }
                      }}
                      className={`${inputFieldClass} min-w-0 flex-1 px-2.5`}
                    />
                    <button
                      type="button"
                      data-testid={`rename-save-${p}`}
                      onClick={() => handleRenameSubmit(p)}
                      className={`${primaryBtnClass} px-3`}
                    >
                      {t('notebook.settings.save')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingPerson(null);
                        setPersonErrorKey('');
                      }}
                      className={`${secondaryBtnClass} px-2.5`}
                    >
                      {t('settings.cancel')}
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="min-w-0 flex-1">
                      <span className="whitespace-nowrap font-semibold text-ink">{displayPersonName}</span>
                      <span className="ml-2 whitespace-nowrap text-meta font-medium text-ink-muted">
                        {t('trip.records', { count: counts[p] || 0 })}
                      </span>
                    </div>
                    {isShared ? (
                      <span className="whitespace-nowrap rounded-sm border border-ink-soft/35 bg-paper-shade px-2.5 py-1 font-hand text-meta font-semibold text-ink-muted">
                        {t('notebook.settings.defaultPersonBadge')}
                      </span>
                    ) : (
                      <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          type="button"
                          data-testid={`person-edit-${p}`}
                          aria-label={t('notebook.settings.renamePersonAria', { name: displayPersonName })}
                          onClick={() => {
                            setEditingPerson(p);
                            setEditingName(p);
                            setPersonErrorKey('');
                          }}
                          className={`${secondaryBtnClass} px-2.5`}
                        >
                          {t('notebook.settings.rename')}
                        </button>
                        <button
                          type="button"
                          data-testid={`person-remove-${p}`}
                          aria-label={t('notebook.settings.removePersonAria', { name: displayPersonName })}
                          onClick={() => handleRemovePerson(p)}
                          className="inline-flex h-11 min-h-11 min-w-11 items-center justify-center whitespace-nowrap rounded-sm border border-coral-ink/35 bg-coral-soft px-2.5 text-sm font-semibold text-coral-ink transition-colors hover:bg-coral-ink hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-ink"
                        >
                          {t('notebook.settings.remove')}
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
            aria-label={t('notebook.settings.addPersonInputAria')}
            data-testid="add-person-input"
            value={newPerson}
            onChange={(e) => {
              setNewPerson(e.target.value);
              setPersonErrorKey('');
            }}
            placeholder={t('notebook.settings.addPersonPlaceholder')}
            className={`${inputFieldClass} min-w-0 flex-1`}
          />
          <button
            type="submit"
            data-testid="add-person-btn"
            className={`${primaryBtnClass} px-4`}
          >
            {t('notebook.settings.addPersonButton')}
          </button>
        </form>
        {personErrorKey && (
          <p role="alert" className="whitespace-nowrap text-meta font-semibold text-coral-ink">
            {t(personErrorKey)}
          </p>
        )}
      </section>

      {/* Currency & Exchange Rate */}
      <section className={sectionCardClass}>
        <WashiLabel tone="kraft" tilt={-1}>
          <h2 className="whitespace-nowrap font-hand text-xs font-bold tracking-widest text-kraft-ink">
            {t('notebook.settings.currencyAndRatesTitle')}
          </h2>
        </WashiLabel>
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-sm border border-ink-soft/40 bg-paper p-2.5">
            <p className="whitespace-nowrap font-hand text-meta text-ink-muted">{t('trip.tripCurrency')}</p>
            <p className="mt-0.5 whitespace-nowrap text-sm font-bold text-ink">
              {t('notebook.settings.jpyLabel')}
            </p>
          </div>
          <div className="rounded-sm border border-ink-soft/40 bg-paper p-2.5">
            <p className="whitespace-nowrap font-hand text-meta text-ink-muted">{t('trip.accountingCurrency')}</p>
            <p className="mt-0.5 whitespace-nowrap text-sm font-bold text-ink">
              {t('notebook.settings.hkdLabel')}
            </p>
          </div>
        </div>
        <form onSubmit={handleSaveRate} noValidate className="space-y-1.5">
          <div className="flex items-center gap-2 rounded-sm border border-ink-soft/40 bg-paper px-3 py-2">
            <label htmlFor="ref-rate-input" className="shrink-0 whitespace-nowrap font-mono text-meta font-semibold text-ink">
              1 JPY =
            </label>
            <input
              id="ref-rate-input"
              data-testid="rate-input"
              aria-label={t('notebook.settings.rateInputAria')}
              type="text"
              inputMode="decimal"
              value={rateInput}
              onChange={(e) => {
                const nextVal = e.target.value;
                setRateInput(nextVal);
                setRateErrorKey(
                  parseRate(nextVal) === null ? 'notebook.settings.rateInvalid' : '',
                );
              }}
              className={`${inputFieldClass} min-w-0 flex-1 px-2.5 font-mono font-semibold`}
            />
            <span className="shrink-0 whitespace-nowrap font-mono text-meta font-semibold text-ink">HKD</span>
            <button
              type="submit"
              data-testid="rate-save"
              disabled={isRateInvalid}
              className={`${primaryBtnClass} px-3`}
            >
              {t('notebook.settings.updateRate')}
            </button>
          </div>
          {(isRateInvalid || rateErrorKey) && (
            <p role="alert" data-testid="rate-error" className="whitespace-nowrap text-meta font-semibold text-coral-ink">
              {t(rateErrorKey || 'notebook.settings.rateInvalid')}
            </p>
          )}
        </form>
      </section>

      {/* Data & Export */}
      <section className={sectionCardClass}>
        <WashiLabel tone="kraft" tilt={-1}>
          <h2 className="whitespace-nowrap font-hand text-xs font-bold tracking-widest text-kraft-ink">
            {t('settings.dataTitle')}
          </h2>
        </WashiLabel>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            data-testid="export-json"
            onClick={handleExportTrip}
            className="jr-btn-paper inline-flex min-h-11 min-w-11 items-center justify-center whitespace-nowrap rounded-sm px-2 py-2.5 font-hand text-meta font-bold text-ink transition-colors hover:bg-paper-shade focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route"
          >
            {t('notebook.settings.exportJson')}
          </button>
          <button
            type="button"
            data-testid="export-backup"
            onClick={handleExportBackup}
            className="jr-btn-paper inline-flex min-h-11 min-w-11 items-center justify-center whitespace-nowrap rounded-sm px-2 py-2.5 font-hand text-meta font-bold text-ink transition-colors hover:bg-paper-shade focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route"
          >
            {t('settings.fullBackup')}
          </button>
          <button
            type="button"
            data-testid="copy-report"
            onClick={handleCopyReport}
            className="jr-btn-paper inline-flex min-h-11 min-w-11 items-center justify-center whitespace-nowrap rounded-sm px-2 py-2.5 font-hand text-meta font-bold text-ink transition-colors hover:bg-paper-shade focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route"
          >
            {t('settings.copyReport')}
          </button>
        </div>
      </section>

      {/* About */}
      <section className={`relative ${sectionCardClass}`}>
        <WashiLabel tone="kraft" tilt={-1}>
          <h2 className="whitespace-nowrap font-hand text-xs font-bold tracking-widest text-kraft-ink">
            {t('notebook.settings.aboutTitle')}
          </h2>
        </WashiLabel>
        <p className="whitespace-nowrap text-meta text-ink-soft">
          {t('notebook.settings.aboutSummary', { amount: fmtJPY(totalJPY) })}
        </p>
      </section>
    </div>
  );
}
