import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import Dialog from './Dialog';
import { AlertCircle } from './Icons';

/**
 * One confirm step that names the thing being removed.
 * Portaled so it can open on top of another dialog (line items inside edit).
 */
export default function ConfirmDeleteDialog({
  open,
  title,
  name,
  message,
  description,
  confirmLabel,
  children,
  confirmDisabled = false,
  onConfirm,
  onCancel,
}) {
  const { t } = useTranslation();
  const dialog = (
    <Dialog open={open} onClose={onCancel} size="sm" ariaLabel={title || t('deleteDialog.title')}>
      <div className="flex items-center gap-3 mb-4">
        <div className="bg-coral-soft p-3 rounded-full">
          <AlertCircle className="text-coral-ink" size={24} />
        </div>
        <h3 className="text-xl font-bold text-ink">{title || t('deleteDialog.title')}</h3>
      </div>
      <p className="text-ink-soft mb-4">
        {message || t('deleteDialog.messageNamed', { name: name || '' })}
      </p>
      {description ? <p className="text-sm text-ink-soft mb-4">{description}</p> : null}
      {children ? <div className="mb-4">{children}</div> : null}
      <div className="flex gap-3">
        <button type="button" autoFocus onClick={onCancel} className="btn-secondary flex-1">{t('deleteDialog.cancel')}</button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={confirmDisabled}
          className="btn-danger flex-1 disabled:opacity-50"
        >
          {confirmLabel || t('deleteDialog.confirm')}
        </button>
      </div>
    </Dialog>
  );

  if (!open || typeof document === 'undefined') return dialog;
  return createPortal(dialog, document.body);
}
