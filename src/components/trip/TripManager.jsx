import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../../store/AppContext';
import { CURRENCY_NAMES } from '../../utils/constants';
import {
  accountingCurrencyOptions,
  getAccountingCode,
  getTripCurrencyCode,
  tripCurrencyOptions,
} from '../../utils/tripMoney';
import Dialog from '../ui/Dialog';
import ConfirmDeleteDialog from '../ui/ConfirmDeleteDialog';
import { Globe, Edit, Trash2 } from '../ui/Icons';

export default function TripManager() {
  const { t } = useTranslation();
  const {
    trips,
    currentTripId,
    currentTrip,
    createTrip,
    deleteTrip,
    updateTrip,
    switchTrip,
    notify,
    settings,
  } = useApp();

  const savedAccountingCodes = settings?.savedAccountingCodes || [];
  const savedTripCurrencies = settings?.savedTripCurrencies || [];

  const tripCurrencyOptionsFor = (trip) => tripCurrencyOptions(trip, savedTripCurrencies);

  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editTripCurrencySelect, setEditTripCurrencySelect] = useState('JPY');
  const [editTripOtherCode, setEditTripOtherCode] = useState('');
  const [editAccountingSelect, setEditAccountingSelect] = useState('HKD');
  const [editOtherCode, setEditOtherCode] = useState('');
  const [deleteId, setDeleteId] = useState(null);
  const [newName, setNewName] = useState('');
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [newTripCurrencySelect, setNewTripCurrencySelect] = useState('JPY');
  const [newTripOtherCode, setNewTripOtherCode] = useState('');
  const [newAccountingSelect, setNewAccountingSelect] = useState('HKD');
  const [newOtherCode, setNewOtherCode] = useState('');

  const openCreate = () => {
    if (currentTrip?.tripCurrencyIsCustom) {
      setNewTripCurrencySelect('OTHER');
      setNewTripOtherCode(getTripCurrencyCode(currentTrip));
    } else {
      setNewTripCurrencySelect(getTripCurrencyCode(currentTrip) || 'JPY');
      setNewTripOtherCode('');
    }
    if (currentTrip?.accountingIsCustom) {
      setNewAccountingSelect('OTHER');
      setNewOtherCode(getAccountingCode(currentTrip));
    } else {
      setNewAccountingSelect(getAccountingCode(currentTrip) || 'HKD');
      setNewOtherCode('');
    }
    setShowCreate(true);
  };

  const handleCreate = () => {
    if (!newName.trim()) {
      notify(t('trip.enterName'), 'warning');
      return;
    }
    let accountCurrency = newAccountingSelect;
    let accountIsCustom = false;
    const extraCodes = [...(currentTrip?.customAccountingCodes || [])];

    if (newAccountingSelect === 'OTHER') {
      const code = newOtherCode.trim().toUpperCase();
      if (!/^[A-Z]{3}$/.test(code)) {
        notify(t('trip.accountingOtherInvalid'), 'warning');
        return;
      }
      accountCurrency = code;
      accountIsCustom = true;
      if (!extraCodes.includes(code)) extraCodes.push(code);
    } else {
      accountCurrency = newAccountingSelect;
      accountIsCustom = false;
    }

    let tripCur = newTripCurrencySelect;
    let tripIsCustom = false;
    const extraTripCodes = [...(currentTrip?.customTripCurrencyCodes || [])];

    if (newTripCurrencySelect === 'OTHER') {
      const code = newTripOtherCode.trim().toUpperCase();
      if (!/^[A-Z]{3}$/.test(code)) {
        notify(t('trip.tripCurrencyOtherInvalid'), 'warning');
        return;
      }
      tripCur = code;
      tripIsCustom = true;
      if (!extraTripCodes.includes(code)) extraTripCodes.push(code);
    } else {
      tripCur = newTripCurrencySelect;
      tripIsCustom = false;
    }

    createTrip(newName.trim(), newDate, tripCur, {
      accountingCurrency: accountCurrency,
      accountingIsCustom: accountIsCustom,
      customAccountingCodes: extraCodes,
      tripCurrencyIsCustom: tripIsCustom,
      customTripCurrencyCodes: extraTripCodes,
    });
    setNewName('');
    setNewDate(new Date().toISOString().split('T')[0]);
    setNewTripCurrencySelect('JPY');
    setNewTripOtherCode('');
    setNewAccountingSelect('HKD');
    setNewOtherCode('');
    setShowCreate(false);
  };

  const handleDelete = (id) => {
    if (id === currentTripId) {
      notify(t('trip.cannotDeleteCurrent'), 'error');
      return;
    }
    if (trips.length <= 1) {
      notify(t('trip.keepOne'), 'warning');
      return;
    }
    setDeleteId(id);
  };

  const confirmDelete = () => {
    deleteTrip(deleteId);
    setDeleteId(null);
  };

  const openEdit = (trip) => {
    setEditId(trip.id);
    setEditName(trip.name);
    if (trip.tripCurrencyIsCustom) {
      setEditTripCurrencySelect('OTHER');
      setEditTripOtherCode(getTripCurrencyCode(trip));
    } else {
      setEditTripCurrencySelect(getTripCurrencyCode(trip));
      setEditTripOtherCode('');
    }
    if (trip.accountingIsCustom) {
      setEditAccountingSelect('OTHER');
      setEditOtherCode(getAccountingCode(trip));
    } else {
      setEditAccountingSelect(getAccountingCode(trip));
      setEditOtherCode('');
    }
  };

  const handleRemoveCustomTripCurrencyCode = (trip, code) => {
    const c = String(code).toUpperCase().slice(0, 3);
    if (getTripCurrencyCode(trip) === c && trip.tripCurrencyIsCustom) {
      notify(t('trip.removeCustomTripCurrencyBlocked'), 'warning');
      return;
    }
    const next = (trip.customTripCurrencyCodes || []).filter((x) => String(x).toUpperCase() !== c);
    updateTrip(trip.id, { customTripCurrencyCodes: next });
    notify(t('trip.removeCustomTripCurrencyOk', { code: c }));
  };

  const handleRemoveCustomAccountingCode = (trip, code) => {
    const c = String(code).toUpperCase().slice(0, 3);
    if (getAccountingCode(trip) === c && trip.accountingIsCustom) {
      notify(t('trip.removeCustomAccountingBlocked'), 'warning');
      return;
    }
    const next = (trip.customAccountingCodes || []).filter((x) => String(x).toUpperCase() !== c);
    updateTrip(trip.id, { customAccountingCodes: next });
    notify(t('trip.removeCustomAccountingOk', { code: c }));
  };

  const handleSaveEdit = () => {
    if (!editName.trim()) {
      notify(t('trip.nameEmpty'), 'warning');
      return;
    }
    const trip = trips.find((tr) => tr.id === editId);
    if (!trip) return;

    let accountCurrency = editAccountingSelect;
    let accountIsCustom = false;
    const extraCodes = [...(trip.customAccountingCodes || [])];

    if (editAccountingSelect === 'OTHER') {
      const code = editOtherCode.trim().toUpperCase();
      if (!/^[A-Z]{3}$/.test(code)) {
        notify(t('trip.accountingOtherInvalid'), 'warning');
        return;
      }
      accountCurrency = code;
      accountIsCustom = true;
      if (!extraCodes.includes(code)) extraCodes.push(code);
    } else {
      accountCurrency = editAccountingSelect;
      accountIsCustom = false;
    }

    let tripCur = editTripCurrencySelect;
    let tripIsCustom = false;
    const extraTripCodes = [...(trip.customTripCurrencyCodes || [])];

    if (editTripCurrencySelect === 'OTHER') {
      const code = editTripOtherCode.trim().toUpperCase();
      if (!/^[A-Z]{3}$/.test(code)) {
        notify(t('trip.tripCurrencyOtherInvalid'), 'warning');
        return;
      }
      tripCur = code;
      tripIsCustom = true;
      if (!extraTripCodes.includes(code)) extraTripCodes.push(code);
    } else {
      tripCur = editTripCurrencySelect;
      tripIsCustom = false;
    }

    updateTrip(editId, {
      name: editName.trim(),
      tripCurrency: tripCur,
      tripCurrencyIsCustom: tripIsCustom,
      customTripCurrencyCodes: extraTripCodes,
      accountingCurrency: accountCurrency,
      accountingIsCustom: accountIsCustom,
      customAccountingCodes: extraCodes,
    });
    setEditId(null);
  };

  const tripToDelete = trips.find((tr) => tr.id === deleteId);

  const accountingOptionsFor = (trip) =>
    accountingCurrencyOptions(trip || currentTrip, savedAccountingCodes);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-ink-soft">{t('trip.title')}</h3>
        <button type="button" onClick={openCreate} className="btn-primary !py-1.5 !px-3 text-xs">
          {t('trip.addTrip')}
        </button>
      </div>

      <div className="space-y-2">
        {trips.map((trip) => (
          <div key={trip.id} className="card p-3">
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <Globe size={14} className="text-ink-muted shrink-0" />
                  <span className="font-medium text-sm truncate">{trip.name}</span>
                  {trip.id === currentTripId && (
                    <span className="text-meta font-bold bg-teal-soft text-teal-strong px-2 py-0.5 rounded-full shrink-0">{t('trip.current')}</span>
                  )}
                </div>
                <p className="text-meta text-ink-muted ml-5">
                  {trip.startDate} · {t('trip.accountingShort', { ac: getAccountingCode(trip) })} · {getTripCurrencyCode(trip)} · {t('trip.records', { count: trip.expenses?.length || 0 })}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {trip.id !== currentTripId && (
                  <button type="button" onClick={() => switchTrip(trip.id)} className="min-h-[36px] px-3 text-sm rounded-lg bg-teal-soft text-teal-strong hover:bg-beige transition-colors font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal">
                    {t('trip.switch')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => openEdit(trip)}
                  className="btn-icon"
                  aria-label={`${t('expenseCard.edit')} ${trip.name}`}
                >
                  <Edit size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(trip.id)}
                  className="btn-icon-danger"
                  aria-label={`${t('expenseCard.delete')} ${trip.name}`}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            {editId === trip.id && (
              <div className="mt-2 p-3 bg-teal-soft rounded-lg border border-teal/40 space-y-2">
                <div>
                  <label htmlFor={`trip-edit-name-${trip.id}`} className="block text-sm text-ink-soft mb-0.5">{t('trip.tripName')}</label>
                  <input
                    id={`trip-edit-name-${trip.id}`}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="input-field w-full"
                    autoFocus
                  />
                </div>
                <div>
                  <label htmlFor={`trip-edit-accounting-${trip.id}`} className="block text-sm text-ink-soft mb-0.5">{t('trip.accountingCurrency')}</label>
                  <select
                    id={`trip-edit-accounting-${trip.id}`}
                    value={editAccountingSelect}
                    onChange={(e) => {
                      setEditAccountingSelect(e.target.value);
                      if (e.target.value !== 'OTHER') setEditOtherCode('');
                    }}
                    className="input-field w-full"
                  >
                    {accountingOptionsFor(trip).map((code) => (
                      <option key={code} value={code}>
                        {CURRENCY_NAMES[code] ? `${code} — ${t(`currency.${code}`)}` : code}
                      </option>
                    ))}
                    <option value="OTHER">{t('settings.otherCurrency')}</option>
                  </select>
                  {editAccountingSelect === 'OTHER' && (
                    <div className="mt-1.5">
                      <label htmlFor={`trip-edit-other-${trip.id}`} className="block text-sm text-ink-muted mb-0.5">{t('trip.accountingOtherCode')}</label>
                      <input
                        id={`trip-edit-other-${trip.id}`}
                        type="text"
                        value={editOtherCode}
                        onChange={(e) => setEditOtherCode(e.target.value.toUpperCase())}
                        maxLength={3}
                        className="input-field w-full uppercase"
                        placeholder="CHF"
                        autoComplete="off"
                      />
                    </div>
                  )}
                  <p className="text-sm text-ink-muted mt-1">{t('trip.accountingCurrencyHint')}</p>
                  {(trip.customAccountingCodes || []).length > 0 && (
                    <div className="mt-2">
                      <p className="text-meta text-ink-soft mb-1">{t('trip.savedCustomAccounting')}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(trip.customAccountingCodes || []).map((code) => (
                          <span
                            key={code}
                            className="inline-flex items-center gap-1 text-meta bg-white border border-line rounded-lg px-2 py-0.5"
                          >
                            {code}
                            <button
                              type="button"
                              onClick={() => handleRemoveCustomAccountingCode(trip, code)}
                              className="text-ink-muted hover:text-coral-ink font-bold leading-none"
                              aria-label={t('trip.removeCustomAccountingAria', { code })}
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                      <p className="text-sm text-ink-muted mt-1">{t('trip.removeCustomAccountingHint')}</p>
                    </div>
                  )}
                </div>
                <div>
                  <label htmlFor={`trip-edit-currency-${trip.id}`} className="block text-sm text-ink-soft mb-0.5">{t('trip.tripCurrency')}</label>
                  <select
                    id={`trip-edit-currency-${trip.id}`}
                    value={editTripCurrencySelect}
                    onChange={(e) => {
                      setEditTripCurrencySelect(e.target.value);
                      if (e.target.value !== 'OTHER') setEditTripOtherCode('');
                    }}
                    className="input-field w-full"
                  >
                    {tripCurrencyOptionsFor(trip).map((code) => (
                      <option key={code} value={code}>
                        {CURRENCY_NAMES[code] ? `${code} — ${t(`currency.${code}`)}` : code}
                      </option>
                    ))}
                    <option value="OTHER">{t('settings.otherCurrency')}</option>
                  </select>
                  {editTripCurrencySelect === 'OTHER' && (
                    <div className="mt-1.5">
                      <label htmlFor={`trip-edit-trip-other-${trip.id}`} className="block text-sm text-ink-muted mb-0.5">{t('trip.tripCurrencyOtherCode')}</label>
                      <input
                        id={`trip-edit-trip-other-${trip.id}`}
                        type="text"
                        value={editTripOtherCode}
                        onChange={(e) => setEditTripOtherCode(e.target.value.toUpperCase())}
                        maxLength={3}
                        className="input-field w-full uppercase"
                        placeholder="CHF"
                        autoComplete="off"
                      />
                    </div>
                  )}
                  <p className="text-sm text-ink-muted mt-1">{t('trip.tripCurrencyHint')}</p>
                  {(trip.customTripCurrencyCodes || []).length > 0 && (
                    <div className="mt-2">
                      <p className="text-meta text-ink-soft mb-1">{t('trip.savedCustomTripCurrency')}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(trip.customTripCurrencyCodes || []).map((code) => (
                          <span
                            key={code}
                            className="inline-flex items-center gap-1 text-meta bg-white border border-line rounded-lg px-2 py-0.5"
                          >
                            {code}
                            <button
                              type="button"
                              onClick={() => handleRemoveCustomTripCurrencyCode(trip, code)}
                              className="text-ink-muted hover:text-coral-ink font-bold leading-none"
                              aria-label={t('trip.removeCustomTripCurrencyAria', { code })}
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                      <p className="text-sm text-ink-muted mt-1">{t('trip.removeCustomTripCurrencyHint')}</p>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={handleSaveEdit} className="btn-primary !py-1.5 !px-3 text-xs flex-1">{t('editExpense.save')}</button>
                  <button type="button" onClick={() => setEditId(null)} className="btn-secondary !py-1.5 !px-3 text-xs flex-1">{t('editExpense.cancel')}</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <Dialog open={showCreate} onClose={() => setShowCreate(false)} title={t('trip.createTitle')} size="sm">
        <div className="space-y-4">
          <div>
            <label htmlFor="trip-name" className="block text-sm font-medium text-ink-soft mb-1">{t('trip.tripName')}</label>
            <input id="trip-name" type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t('trip.tripNamePlaceholder')} className="input-field" autoComplete="off" />
          </div>
          <div>
            <label htmlFor="trip-date" className="block text-sm font-medium text-ink-soft mb-1">{t('trip.startDate')}</label>
            <input id="trip-date" type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="input-field" />
          </div>
          <div>
            <label htmlFor="trip-new-accounting" className="block text-sm font-medium text-ink-soft mb-1">{t('trip.accountingCurrency')}</label>
            <select
              id="trip-new-accounting"
              value={newAccountingSelect}
              onChange={(e) => {
                setNewAccountingSelect(e.target.value);
                if (e.target.value !== 'OTHER') setNewOtherCode('');
              }}
              className="input-field"
            >
              {accountingOptionsFor(currentTrip).map((code) => (
                <option key={code} value={code}>
                  {CURRENCY_NAMES[code] ? `${code} — ${t(`currency.${code}`)}` : code}
                </option>
              ))}
              <option value="OTHER">{t('settings.otherCurrency')}</option>
            </select>
            {newAccountingSelect === 'OTHER' && (
              <div className="mt-2">
                <label htmlFor="trip-new-other" className="block text-sm text-ink-soft mb-1">{t('trip.accountingOtherCode')}</label>
                <input
                  id="trip-new-other"
                  type="text"
                  value={newOtherCode}
                  onChange={(e) => setNewOtherCode(e.target.value.toUpperCase())}
                  maxLength={3}
                  className="input-field uppercase"
                  placeholder="CHF"
                  autoComplete="off"
                />
              </div>
            )}
            <p className="text-sm text-ink-muted mt-1">{t('trip.accountingCurrencyHint')}</p>
          </div>
          <div>
            <label htmlFor="trip-currency" className="block text-sm font-medium text-ink-soft mb-1">{t('trip.tripCurrency')}</label>
            <select
              id="trip-currency"
              value={newTripCurrencySelect}
              onChange={(e) => {
                setNewTripCurrencySelect(e.target.value);
                if (e.target.value !== 'OTHER') setNewTripOtherCode('');
              }}
              className="input-field"
            >
              {tripCurrencyOptionsFor(currentTrip).map((code) => (
                <option key={code} value={code}>
                  {CURRENCY_NAMES[code] ? `${code} — ${t(`currency.${code}`)}` : code}
                </option>
              ))}
              <option value="OTHER">{t('settings.otherCurrency')}</option>
            </select>
            {newTripCurrencySelect === 'OTHER' && (
              <div className="mt-2">
                <label htmlFor="trip-new-trip-other" className="block text-sm text-ink-soft mb-1">{t('trip.tripCurrencyOtherCode')}</label>
                <input
                  id="trip-new-trip-other"
                  type="text"
                  value={newTripOtherCode}
                  onChange={(e) => setNewTripOtherCode(e.target.value.toUpperCase())}
                  maxLength={3}
                  className="input-field uppercase"
                  placeholder="CHF"
                  autoComplete="off"
                />
              </div>
            )}
            <p className="text-sm text-ink-muted mt-1">{t('trip.tripCurrencyHint')}</p>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary flex-1">{t('editExpense.cancel')}</button>
          <button type="button" onClick={handleCreate} className="btn-primary flex-1">{t('trip.create')}</button>
        </div>
      </Dialog>

      <ConfirmDeleteDialog
        open={!!deleteId}
        title={t('trip.deleteTitle')}
        name={tripToDelete?.name || ''}
        description={t('trip.deleteDetail')}
        confirmLabel={t('settings.confirmDelete')}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />
    </section>
  );
}
