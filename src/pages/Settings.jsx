import { useState, useRef, useEffect } from 'react';
import { STRIPE_UI_ENABLED } from '../config/features';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
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
import { formatExchangeRateInputValue } from '../utils/rateDisplay';
import TripManager from '../components/trip/TripManager';
import PlanStatus from '../components/billing/PlanStatus';
import { Copy, Download, FileText, Upload, Trash2, Edit, RefreshCw } from '../components/ui/Icons';
import Dialog from '../components/ui/Dialog';
import ConfirmDeleteDialog from '../components/ui/ConfirmDeleteDialog';

export default function Settings() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, session, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const checkoutReturnNotified = useRef(false);
  const {
    settings,
    billing,
    planView,
    refreshBilling,
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
    addCustomExpenseCategory,
    removeCustomExpenseCategory,
  } = useApp();

  const uiLanguage = settings?.uiLanguage ?? 'zh-TW';
  const exchangeRatesUpdatedAt = currentTrip?.exchangeRatesUpdatedAt;
  const manualRateCodes = currentTrip?.manualRateCodes || [];
  const exchangeRateUserEditedCodes = currentTrip?.exchangeRateUserEditedCodes || [];

  const importRef = useRef(null);

  useEffect(() => {
    if (checkoutReturnNotified.current) return;
    const v = searchParams.get('checkout');
    if (!v) return;
    checkoutReturnNotified.current = true;
    if (v === 'success') notify(t('settings.billingSuccess'), 'success');
    else if (v === 'cancelled') notify(t('settings.billingCancelled'), 'info');
    if (v === 'success') {
      window.setTimeout(() => {
        refreshBilling();
      }, 1800);
    }
    navigate('/settings', { replace: true });
  }, [searchParams, navigate, notify, refreshBilling, t]);

  const [deleteCategory, setDeleteCategory] = useState(null);
  const [newCustomCategory, setNewCustomCategory] = useState('');
  const customExpenseCategories = settings?.customExpenseCategories || [];

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

  const patchTripRates = (nextRates, nextManual, nextUpdated, extra = {}) => {
    updateTrip(currentTripId, {
      exchangeRates: nextRates,
      manualRateCodes: nextManual,
      ...(nextUpdated !== undefined ? { exchangeRatesUpdatedAt: nextUpdated } : {}),
      ...extra,
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
      patchTripRates(merged, manualRateCodes, new Date().toISOString(), {
        exchangeRateUserEditedCodes: [],
      });
      if (expenses.length === 0) notify(t('toast.fetchRatesOk'));
    } catch {
      notify(t('toast.fetchRatesFailed'), 'error');
    } finally {
      setRatesLoading(false);
    }
  };

  const handleRateBlur = (code, value) => {
    if (code === homeCurrencyCode) return;
    const prev = exchangeRates[code] ?? 1;
    const v = parseFloat(value);
    if (!Number.isFinite(v) || v <= 0) return;

    const isManual = manualRateCodes.includes(code);
    const wasEdited = exchangeRateUserEditedCodes.includes(code);

    if (!isManual && !wasEdited) {
      const roundedDisplay = Number(Number(prev).toFixed(2));
      if (Math.abs(v - roundedDisplay) < 1e-9) {
        return;
      }
    }

    const nextEdited = new Set(exchangeRateUserEditedCodes);
    if (!isManual) nextEdited.add(code);

    patchTripRates(
      { ...exchangeRates, [code]: v },
      manualRateCodes,
      exchangeRatesUpdatedAt,
      { exchangeRateUserEditedCodes: [...nextEdited] },
    );
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
    const nextUserEdited = exchangeRateUserEditedCodes.filter((c) => c !== code);
    patchTripRates(nextRates, nextManual, exchangeRatesUpdatedAt, {
      exchangeRateUserEditedCodes: nextUserEdited,
    });
  };

  const handleAddCustomCategory = () => {
    const r = addCustomExpenseCategory(newCustomCategory);
    if (r.ok) {
      setNewCustomCategory('');
      return;
    }
    const key =
      r.reason === 'empty'
        ? 'settings.customCategoryEmptyName'
        : r.reason === 'long'
          ? 'settings.customCategoryTooLong'
          : r.reason === 'preset'
            ? 'settings.customCategoryReserved'
            : r.reason === 'duplicate'
              ? 'settings.customCategoryDuplicate'
              : 'settings.customCategoryLimit';
    notify(t(key), 'warning');
  };

  const handleRemoveCustomCategory = (name) => {
    removeCustomExpenseCategory(name);
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

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      navigate('/login', { replace: true });
    } finally {
      setSigningOut(false);
    }
  };

  const handleStartCheckout = async () => {
    const accessToken = session?.access_token;
    if (!accessToken) {
      notify(t('settings.billingNoSession'), 'warning');
      return;
    }
    setCheckoutLoading(true);
    try {
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: '{}',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        notify(data.error || t('settings.billingError'), 'error');
        return;
      }
      if (data.url) window.location.assign(data.url);
      else notify(t('settings.billingError'), 'error');
    } catch {
      notify(t('settings.billingError'), 'error');
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleRefreshBilling = async () => {
    const { outcome } = await refreshBilling();
    // A superseded refresh says nothing: the newer one will report.
    if (outcome === 'failed') notify(t('settings.billingRefreshError'), 'error');
    else if (outcome === 'ok') notify(t('settings.billingRefreshed'));
  };

  const stripePlanCard = STRIPE_UI_ENABLED && (planView.state === 'pro' || planView.state === 'free') ? (
    <div className="rounded-[22px] bg-cream-soft border border-line p-4">
      <p className="eyebrow">{t('settings.billingNextLabel')}</p>
      <p className="mt-2 text-sm font-semibold text-ink">
        {planView.state === 'pro' ? t('settings.billingEnjoyPro') : t('settings.billingUpgradePrompt')}
      </p>
      <p className="mt-2 text-sm text-ink-muted">
        {planView.state === 'pro' ? t('settings.billingEnjoyProHint') : t('settings.billingUpgradeHint')}
      </p>
    </div>
  ) : null;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="eyebrow">{t('settings.pageEyebrow')}</p>
        <h1 className="display-title text-ink">{t('settings.title')}</h1>
        <p className="text-sm text-ink-muted max-w-2xl">{t('settings.pageIntro')}</p>
      </div>

      <section className="paper-panel p-5 space-y-2">
        <h2 className="section-title">{t('settings.accountTitle')}</h2>
        <p className="text-sm text-ink-soft break-all">{user?.email ?? '—'}</p>
        <button
          type="button"
          className="btn-secondary text-sm !py-2"
          onClick={handleSignOut}
          disabled={signingOut}
        >
          {signingOut ? t('auth.submitting') : t('settings.signOut')}
        </button>
      </section>

      <section className="paper-panel p-5 space-y-4">
        <PlanStatus variant="panel" extra={stripePlanCard} onRetry={handleRefreshBilling}>
          <p className="eyebrow">{t('settings.billingEyebrow')}</p>
          <h2 className="section-title">{t('settings.billingTitle')}</h2>
          {STRIPE_UI_ENABLED && (
            <p className="text-sm text-ink-muted max-w-xl leading-relaxed">{t('settings.billingHint')}</p>
          )}
        </PlanStatus>
        <div className="flex flex-wrap gap-2">
          {/* Checkout only once the plan is known; never offer it to a Pro still loading. */}
          {STRIPE_UI_ENABLED && (planView.state === 'free' || planView.state === 'pro') && (
            <button
              type="button"
              className="btn-primary text-sm !py-2"
              onClick={handleStartCheckout}
              disabled={checkoutLoading || !session?.access_token || planView.state === 'pro'}
            >
              {planView.state === 'pro'
                ? t('settings.billingSubscribed')
                : checkoutLoading ? t('settings.billingLoading') : t('settings.billingSubscribe')}
            </button>
          )}
          {/* In the error state PlanStatus renders its own retry; don't show two. */}
          {planView.state !== 'error' && (
          <button
            type="button"
            className="btn-secondary text-sm !py-2 flex items-center gap-2"
            onClick={handleRefreshBilling}
            disabled={billing.refreshing}
          >
            <RefreshCw size={16} className={billing.refreshing ? 'animate-spin-slow' : ''} />
            {billing.refreshing ? t('settings.billingRefreshing') : t('settings.billingRefresh')}
          </button>
          )}
        </div>
      </section>

      <section className="paper-panel p-5 space-y-3">
        <h2 className="section-title">{t('settings.language')}</h2>
        <select
          value={uiLanguage}
          onChange={(e) => updateSettings({ uiLanguage: e.target.value })}
          className="input-field"
        >
          <option value="zh-TW">{t('settings.languageZhTW')}</option>
          <option value="en">{t('settings.languageEn')}</option>
        </select>
      </section>

      <section className="paper-panel p-5">
        <TripManager />
      </section>

      <section className="paper-panel p-5 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="section-title">{t('settings.ratesTitle', { home: homeCurrencyCode })}</h2>
            <p className="text-sm text-ink-muted">{t('settings.ratesHintTrip')}</p>
            {exchangeRatesUpdatedAt && (
              <p className="text-sm text-ink-muted mt-1">
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
            <label htmlFor="add-manual-rate" className="block text-meta text-ink-soft mb-0.5">{t('settings.addManualLabel')}</label>
            <div className="flex gap-2">
              <input
                id="add-manual-rate"
                type="text"
                value={addManualCode}
                onChange={(e) => setAddManualCode(e.target.value.toUpperCase())}
                maxLength={3}
                placeholder="TWD"
                className="input-field uppercase flex-1"
                autoComplete="off"
              />
              <button type="button" onClick={handleAddManualRate} className="btn-secondary !py-2 !px-3 text-xs shrink-0">
                {t('settings.addManual')}
              </button>
            </div>
            <p className="text-sm text-ink-muted mt-1">{t('settings.addManualHint')}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto">
          {rateGridCodes.map((code) => {
            const isManual = manualRateCodes.includes(code);
            const userEdited = exchangeRateUserEditedCodes.includes(code);
            const displayStr = formatExchangeRateInputValue(
              code,
              exchangeRates[code] ?? 1,
              homeCurrencyCode,
              isManual,
              exchangeRateUserEditedCodes,
            );
            return (
              <div key={code} className="bg-cream p-2 rounded-lg border border-line relative">
                <div className="flex items-center justify-between gap-1 mb-0.5">
                  <label className="block text-meta text-ink-muted">{code}</label>
                  {isManual && (
                    <span className="text-meta font-bold text-mustard-ink bg-mustard-soft px-1 rounded">{t('settings.rateManualBadge')}</span>
                  )}
                </div>
                <p className="text-meta text-ink-muted mb-0.5 tabular-nums">{t('settings.rateOneHomeLabel', { home: homeCurrencyCode })}</p>
                <input
                  key={`${code}-${exchangeRates[code]}-${isManual ? 'm' : 'a'}-${userEdited ? 'e' : 's'}`}
                  type="number"
                  step={isManual || userEdited ? '0.0001' : '0.01'}
                  defaultValue={displayStr}
                  disabled={code === homeCurrencyCode}
                  onBlur={(e) => handleRateBlur(code, e.target.value)}
                  className="w-full p-1.5 text-sm border border-line rounded bg-white focus:outline-none focus:ring-2 focus:ring-teal disabled:bg-beige disabled:text-ink-muted"
                />
                {isManual && (
                  <button
                    type="button"
                    onClick={() => handleRemoveManualRate(code)}
                    className="mt-1 text-sm text-coral-ink hover:underline w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-ink rounded"
                  >
                    {t('settings.removeManual')}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="paper-panel p-5 space-y-3">
        <h2 className="section-title">{t('settings.peopleTitle')}</h2>
        <div className="space-y-1.5 max-h-36 overflow-y-auto">
          {people.map((person) => (
            <div key={person} className="flex items-center gap-2 bg-cream p-2 rounded-lg border border-line">
              <span className="flex-1 text-sm">{person}</span>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => openEditPerson(person)}
                  className="btn-icon"
                  aria-label={`${t('settings.editPersonTitle')}: ${person}`}
                >
                  <Edit size={16} />
                </button>
                {people.length > 1 && (
                  <button
                    type="button"
                    onClick={() => openDeletePerson(person)}
                    className="btn-icon-danger"
                    aria-label={`${t('settings.confirmDelete')} ${person}`}
                  >
                    <Trash2 size={16} />
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

      <section className="paper-panel p-5 space-y-3">
        <h2 className="section-title">{t('settings.customCategoriesTitle')}</h2>
        <p className="text-sm text-ink-muted leading-snug">{t('settings.customCategoriesHint')}</p>
        <div className="space-y-1.5 max-h-36 overflow-y-auto">
          {customExpenseCategories.map((cat) => (
            <div
              key={cat}
              className="flex items-center gap-2 bg-cream p-2 rounded-lg border border-line"
            >
              <span className="flex-1 text-sm text-ink">{cat}</span>
              <button
                type="button"
                onClick={() => setDeleteCategory(cat)}
                className="btn-icon-danger shrink-0"
                aria-label={t('settings.customCategoryRemoveAria', { name: cat })}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          {customExpenseCategories.length === 0 && (
            <p className="text-sm text-ink-muted py-1">{t('settings.customCategoriesEmpty')}</p>
          )}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newCustomCategory}
            onChange={(e) => setNewCustomCategory(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddCustomCategory();
            }}
            placeholder={t('settings.customCategoryPlaceholder')}
            className="input-field flex-1 text-sm"
            maxLength={40}
            autoComplete="off"
          />
          <button
            type="button"
            onClick={handleAddCustomCategory}
            className="btn-primary !py-2 !px-4 text-sm"
          >
            {t('settings.customCategoryAdd')}
          </button>
        </div>
      </section>

      <section className="paper-panel p-5 space-y-3">
        <h2 className="section-title">{t('settings.dataTitle')}</h2>
        <p className="text-sm text-ink-muted leading-snug">
          {t('settings.dataHint')}
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => exportExpenses(expenses)} className="btn-ghost flex-1 min-w-[100px] flex items-center justify-center gap-2 border border-line text-sm">
            <Download size={16} /> {t('settings.export')}
          </button>
          <label className="btn-ghost flex-1 min-w-[100px] flex items-center justify-center gap-2 border border-line text-sm cursor-pointer">
            <Upload size={16} /> {t('settings.import')}
            <input type="file" accept=".json" ref={importRef} onChange={handleImport} className="hidden" />
          </label>
          <button type="button" onClick={() => exportFullBackup(expenses, settings)} className="btn-ghost flex-1 min-w-[100px] flex items-center justify-center gap-2 border border-line text-sm">
            <Download size={16} /> {t('settings.fullBackup')}
          </button>
        </div>
        <button
          type="button"
          onClick={handleCopyReport}
          disabled={!expenses.length}
          className="btn-ghost w-full flex items-center justify-center gap-2 border border-line text-sm disabled:opacity-50"
        >
          <Copy size={16} /> {t('settings.copyReport')}
        </button>
        <button
          type="button"
          className="hidden w-full flex items-center justify-center gap-2 border border-line text-sm rounded-xl py-2.5 text-ink-soft hover:bg-beige"
          onClick={() => window.print()}
          disabled={!expenses.length}
        >
          <FileText size={16} /> {t('settings.printPage')}
        </button>
      </section>

      <Dialog open={!!editPerson} onClose={() => setEditPerson(null)} size="sm">
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-ink">{t('settings.editPersonTitle')}</h3>
          <div>
            <label htmlFor="edit-person-name" className="block text-sm font-medium text-ink-soft mb-1">{t('settings.editPersonNameLabel')}</label>
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

      <ConfirmDeleteDialog
        open={!!deletePerson}
        title={t('settings.deletePersonTitle', { name: deletePerson || '' })}
        name={deletePerson || ''}
        message={t('settings.deletePersonHint')}
        confirmLabel={t('settings.confirmDelete')}
        confirmDisabled={!deleteReassignTo}
        onConfirm={confirmDeletePerson}
        onCancel={() => { setDeletePerson(null); setDeleteReassignTo(''); }}
      >
        <label htmlFor="delete-reassign" className="block text-sm font-medium text-ink-soft mb-1 text-left">{t('settings.deletePersonReassignLabel')}</label>
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
      </ConfirmDeleteDialog>

      <ConfirmDeleteDialog
        open={!!deleteCategory}
        name={deleteCategory || ''}
        description={t('settings.deleteCategoryDetail')}
        onConfirm={() => {
          handleRemoveCustomCategory(deleteCategory);
          setDeleteCategory(null);
        }}
        onCancel={() => setDeleteCategory(null)}
      />
    </div>
  );
}
