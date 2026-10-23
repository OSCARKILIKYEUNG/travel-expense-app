import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Dialog from '../ui/Dialog';
import { AlertCircle } from '../ui/Icons';
import { getExpenseStoreDisplay } from '../../utils/displayNames';
import { isUserEdited } from '../../utils/duplicates';
import {
  createDuplicateReviewState,
  duplicateReviewReduce,
  shouldShowReplaceConfirm,
} from '../../utils/duplicateDecisions';
import { formatNumber } from '../../utils/currency';

function summarize(expense, t, lang) {
  const numeric = Number(expense.originalAmount) || 0;
  const amount = formatNumber(numeric, 'auto');
  return t('duplicateDialog.summary', {
    store: getExpenseStoreDisplay(expense, lang, t),
    date: expense.date,
    amount: `${expense.currency || ''} ${amount}`.trim(),
    count: expense.items?.length || 0,
  });
}

const CHOICES = ['skip', 'keep', 'replace'];

/**
 * One review dialog per upload batch.
 * - Default choice for every receipt is 略過 (skip). 取代舊記錄 is never default and has no "apply to all".
 * - Replace needs a second confirmation step.
 * - Closing without confirming keeps all new records (onClose) and the list banner shows.
 *
 * @param {{ open: boolean, conflicts: Array<{record:object, matchId:number, level:string}>,
 *   existing: object[], onConfirm: (decisions: Record<string, string>) => void, onClose: () => void }} props
 */
export default function DuplicateReviewDialog({ open, conflicts, existing, onConfirm, onClose }) {
  const { t, i18n } = useTranslation();
  const sessionKey = open ? (conflicts || []).map((c) => String(c?.record?.id ?? '')).join('|') : '';
  const [review, setReview] = useState(() => createDuplicateReviewState(existing));
  const [seenSession, setSeenSession] = useState(sessionKey);
  // Reset before paint when a new batch opens, so a previous 取代 confirm
  // cannot reappear (with a zero count) for the next edited record.
  let reviewNow = review;
  if (seenSession !== sessionKey) {
    reviewNow = createDuplicateReviewState(existing);
    setSeenSession(sessionKey);
    setReview(reviewNow);
  }

  if (!open) return null;

  const choiceOf = (id) => reviewNow.choices[id] || 'skip';
  const byId = new Map((existing || []).map((e) => [e.id, e]));
  const replaceRows = (conflicts || []).filter((c) => choiceOf(c.record.id) === 'replace' && byId.has(c.matchId));
  const anyEdited = replaceRows.some((c) => isUserEdited(byId.get(c.matchId)));

  const finalize = () => {
    const decisions = {};
    for (const c of conflicts) decisions[c.record.id] = choiceOf(c.record.id);
    onConfirm(decisions);
  };

  const handleConfirm = () => {
    if (replaceRows.length > 0) {
      setReview((s) => duplicateReviewReduce(s, { type: 'requestConfirm', replaceCount: replaceRows.length }));
      return;
    }
    finalize();
  };

  if (shouldShowReplaceConfirm(reviewNow, replaceRows.length)) {
    return (
      <Dialog open onClose={onClose} size="sm">
        <div data-review-step="confirm" className="flex items-center gap-3 mb-4">
          <div className="bg-coral-soft p-3 rounded-full">
            <AlertCircle className="text-coral-ink" size={24} />
          </div>
          <h3 className="text-xl font-bold text-ink">{t('duplicateDialog.replaceConfirmTitle')}</h3>
        </div>
        <p className="text-ink-soft mb-3">{t('duplicateDialog.replaceConfirmMessage', { count: replaceRows.length })}</p>
        <ul className="mb-3 space-y-1 text-sm text-ink-soft">
          {replaceRows.map((c) => (
            <li key={c.record.id}>
              {summarize(byId.get(c.matchId), t, i18n.language)}
              {isUserEdited(byId.get(c.matchId)) && (
                <span className="ml-1 text-mustard-ink font-semibold">{t('duplicateDialog.editedBadge')}</span>
              )}
            </li>
          ))}
        </ul>
        {anyEdited && <p className="text-sm text-mustard-ink mb-3">{t('duplicateDialog.editedWarning')}</p>}
        <p className="text-sm text-ink-muted mb-5">{t('duplicateDialog.undoNote')}</p>
        <div className="flex gap-3">
          <button type="button" onClick={() => setReview((s) => duplicateReviewReduce(s, { type: 'back' }))} className="btn-secondary min-h-11 flex-1 whitespace-nowrap">
            {t('duplicateDialog.back')}
          </button>
          <button type="button" onClick={finalize} className="btn-danger min-h-11 flex-1 whitespace-nowrap">
            {t('duplicateDialog.replaceConfirm')}
          </button>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog open onClose={onClose} title={t('duplicateDialog.title')} size="lg">
      <div className="space-y-3" data-review-step="choose">
        <p className="text-xs text-ink-soft">
          {t('duplicateDialog.body', { count: conflicts.length })}
        </p>
        <ul className="space-y-3 max-h-[55vh] overflow-y-auto">
          {conflicts.map((c) => {
            const old = byId.get(c.matchId);
            const choice = choiceOf(c.record.id);
            const existingSummary = old ? summarize(old, t, i18n.language) : t('duplicateDialog.existingMissing');
            const editedSuffix = old && isUserEdited(old) ? ` ${t('duplicateDialog.editedBadge')}` : '';
            const existingFullText = `${t('duplicateDialog.existing')} ${existingSummary}${editedSuffix}`;
            const scannedSummary = summarize(c.record, t, i18n.language);
            const scannedFullText = `${t('duplicateDialog.scanned')} ${scannedSummary}`;
            const hintFullText = c.level === 'strong' ? t('duplicateDialog.hintStrong') : t('duplicateDialog.hintLikely');
            return (
              <li key={c.record.id} className="min-w-0 rounded-2xl border border-line bg-cream-soft p-3 space-y-2">
                <div className="min-w-0 text-xs space-y-1">
                  <p className="min-w-0 truncate" title={existingFullText}>
                    <span className="font-semibold text-ink-muted">{t('duplicateDialog.existing')}</span>{' '}
                    {existingSummary}
                    {old && isUserEdited(old) && (
                      <span className="ml-1 text-mustard-ink font-semibold">{t('duplicateDialog.editedBadge')}</span>
                    )}
                  </p>
                  <p className="min-w-0 truncate" title={scannedFullText}>
                    <span className="font-semibold text-teal-strong">{t('duplicateDialog.scanned')}</span>{' '}
                    {scannedSummary}
                  </p>
                  <p className="min-w-0 truncate text-mustard-ink" title={hintFullText}>
                    {hintFullText}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2" role="group">
                  {CHOICES.map((key) => {
                    const selected = choice === key;
                    const disabled = key === 'replace' && !old;
                    const base = 'inline-flex min-h-11 min-w-11 items-center justify-center whitespace-nowrap rounded-xl px-3 py-2 text-xs font-semibold border transition-colors disabled:opacity-40';
                    const tone = selected
                      ? key === 'replace'
                        ? 'bg-coral-ink text-white border-coral-ink'
                        : 'bg-teal-strong text-white border-teal-strong'
                      : key === 'replace'
                        ? 'bg-white text-coral-ink border-coral-ink/30'
                        : 'bg-white text-ink-soft border-line';
                    return (
                      <button
                        key={key}
                        type="button"
                        aria-pressed={selected}
                        disabled={disabled}
                        data-choice={key}
                        onClick={() => setReview((s) => duplicateReviewReduce(s, { type: 'choose', id: c.record.id, choice: key }))}
                        className={`${base} ${tone}`}
                      >
                        {t(`duplicateDialog.choice_${key}`)}
                      </button>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-ink-muted">{t('duplicateDialog.closeNote')}</p>
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="btn-secondary min-h-11 flex-1 whitespace-nowrap">{t('duplicateDialog.decideLater')}</button>
          <button type="button" onClick={handleConfirm} className="btn-primary min-h-11 flex-1 whitespace-nowrap">{t('duplicateDialog.confirm')}</button>
        </div>
      </div>
    </Dialog>
  );
}
