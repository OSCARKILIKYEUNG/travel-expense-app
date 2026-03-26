import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../../store/AppContext';
import Dialog from '../ui/Dialog';
import { Globe, Edit, Trash2 } from '../ui/Icons';

export default function TripManager() {
  const { t } = useTranslation();
  const { trips, currentTripId, createTrip, deleteTrip, updateTripName, switchTrip, notify } = useApp();
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');
  const [deleteId, setDeleteId] = useState(null);
  const [newName, setNewName] = useState('');
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);

  const handleCreate = () => {
    if (!newName.trim()) { notify(t('trip.enterName'), 'warning'); return; }
    createTrip(newName.trim(), newDate);
    setNewName('');
    setNewDate(new Date().toISOString().split('T')[0]);
    setShowCreate(false);
  };

  const handleDelete = (id) => {
    if (id === currentTripId) { notify(t('trip.cannotDeleteCurrent'), 'error'); return; }
    if (trips.length <= 1) { notify(t('trip.keepOne'), 'warning'); return; }
    setDeleteId(id);
  };

  const confirmDelete = () => {
    deleteTrip(deleteId);
    setDeleteId(null);
  };

  const handleSaveEdit = () => {
    if (!editName.trim()) { notify(t('trip.nameEmpty'), 'warning'); return; }
    updateTripName(editId, editName.trim());
    setEditId(null);
  };

  const tripToDelete = trips.find((t) => t.id === deleteId);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-700">{t('trip.title')}</h3>
        <button type="button" onClick={() => setShowCreate(true)} className="btn-primary !py-1.5 !px-3 text-xs">
          {t('trip.addTrip')}
        </button>
      </div>

      <div className="space-y-2">
        {trips.map((trip) => (
          <div key={trip.id} className="card p-3">
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <Globe size={14} className="text-slate-400 shrink-0" />
                  <span className="font-medium text-sm truncate">{trip.name}</span>
                  {trip.id === currentTripId && (
                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full shrink-0">{t('trip.current')}</span>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 ml-5">{trip.startDate} · {t('trip.records', { count: trip.expenses?.length || 0 })}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                {trip.id !== currentTripId && (
                  <button type="button" onClick={() => switchTrip(trip.id)} className="text-[10px] px-2 py-1 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors font-medium">
                    {t('trip.switch')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { setEditId(trip.id); setEditName(trip.name); }}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition-colors"
                  aria-label={`${t('expenseCard.edit')} ${trip.name}`}
                >
                  <Edit size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(trip.id)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-red-500 transition-colors"
                  aria-label={`${t('expenseCard.delete')} ${trip.name}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {editId === trip.id && (
              <div className="mt-2 p-2 bg-indigo-50 rounded-lg border border-indigo-200 flex gap-2">
                <input value={editName} onChange={(e) => setEditName(e.target.value)} className="input-field flex-1 text-xs" autoFocus />
                <button type="button" onClick={handleSaveEdit} className="btn-primary !py-1.5 !px-3 text-xs">{t('editExpense.save')}</button>
                <button type="button" onClick={() => setEditId(null)} className="btn-secondary !py-1.5 !px-3 text-xs">{t('editExpense.cancel')}</button>
              </div>
            )}
          </div>
        ))}
      </div>

      <Dialog open={showCreate} onClose={() => setShowCreate(false)} title={t('trip.createTitle')} size="sm">
        <div className="space-y-4">
          <div>
            <label htmlFor="trip-name" className="block text-sm font-medium text-slate-700 mb-1">{t('trip.tripName')}</label>
            <input id="trip-name" type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t('trip.tripNamePlaceholder')} className="input-field" autoComplete="off" />
          </div>
          <div>
            <label htmlFor="trip-date" className="block text-sm font-medium text-slate-700 mb-1">{t('trip.startDate')}</label>
            <input id="trip-date" type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="input-field" />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary flex-1">{t('editExpense.cancel')}</button>
          <button type="button" onClick={handleCreate} className="btn-primary flex-1">{t('trip.create')}</button>
        </div>
      </Dialog>

      <Dialog open={!!deleteId} onClose={() => setDeleteId(null)} size="sm">
        <div className="text-center mb-4">
          <div className="mx-auto w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mb-3">
            <span className="text-2xl">⚠️</span>
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-1">{t('trip.deleteTitle')}</h3>
          <p className="text-sm text-slate-600">{t('trip.deleteMessage', { name: tripToDelete?.name })}</p>
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={() => setDeleteId(null)} className="btn-secondary flex-1">{t('editExpense.cancel')}</button>
          <button type="button" onClick={confirmDelete} className="btn-danger flex-1">{t('settings.confirmDelete')}</button>
        </div>
      </Dialog>
    </section>
  );
}
