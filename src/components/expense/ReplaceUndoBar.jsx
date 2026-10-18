import { useTranslation } from 'react-i18next';
import { useApp } from '../../store/AppContext';
import { isUndoActive } from '../../utils/duplicateDecisions';

/** Floating bar offering 還原 for a short time after 取代舊記錄. */
export default function ReplaceUndoBar() {
  const { t } = useTranslation();
  const { replaceUndo, undoLastReplace, currentTripId } = useApp();
  if (!isUndoActive(replaceUndo, currentTripId)) return null;
  return (
    <div
      className="fixed bottom-24 lg:bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-3 bg-slate-800 text-white animate-slide-up"
      role="status"
      aria-live="polite"
    >
      <span className="text-sm font-medium">{t('duplicateDialog.replacedToast', { count: replaceUndo.entries.length })}</span>
      <button type="button" onClick={undoLastReplace} className="text-sm font-bold underline underline-offset-2">
        {t('duplicateDialog.undo')}
      </button>
    </div>
  );
}
