import { useTranslation } from 'react-i18next';
import Dialog from '../ui/Dialog';
import { AlertCircle } from '../ui/Icons';

export default function DeleteConfirmDialog({ open, store, onConfirm, onCancel }) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onClose={onCancel} size="sm">
      <div className="flex items-center gap-3 mb-4">
        <div className="bg-red-100 p-3 rounded-full">
          <AlertCircle className="text-red-600" size={24} />
        </div>
        <h3 className="text-xl font-bold text-slate-900">{t('deleteDialog.title')}</h3>
      </div>
      <p className="text-slate-600 mb-6">
        {t('deleteDialog.message', { store })}
      </p>
      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1">{t('deleteDialog.cancel')}</button>
        <button type="button" onClick={onConfirm} className="btn-danger flex-1">{t('deleteDialog.confirm')}</button>
      </div>
    </Dialog>
  );
}
