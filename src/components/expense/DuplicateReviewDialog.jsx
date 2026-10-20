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
  const frac = Math.abs(numeric % 1);
  const decimals = frac > 1e-6 && frac < 1 - 1e-6 ? 2 : 0;
  const amount = formatNumber(numeric, decimals);
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
          <div className="bg-red-100 p-3 rounded-full">
            <AlertCircle className="text-red-600" size={24} />
          </div>
          <h3 className="text-xl font-bold text-slate-900">{t('duplicateDialog.replaceConfirmTitle')}</h3>
        </div>
        <p className="text-slate-600 mb-3">{t('duplicateDialog.replaceConfirmMessage', { count: replaceRows.length })}</p>
        <ul className="mb-3 space-y-1 text-sm text-[color:var(--ink-soft)]">
          {replaceRows.map((c) => (
            <li key={c.record.id}>
              {summarize(byId.get(c.matchId), t, i18n.language)}
              {isUserEdited(byId.get(c.matchId)) && (
                <span className="ml-1 text-amber-700 font-semibold">{t('duplicateDialog.editedBadge')}</span>
              )}
            </li>
          ))}
        </ul>
        {anyEdited && <p className="text-sm text-amber-700 mb-3">{t('duplicateDialog.editedWarning')}</p>}
        <p className="text-xs text-[color:var(--ink-muted)] mb-5">{t('duplicateDialog.undoNote')}</p>
        <div className="flex gap-3">
          <button type="button" onClick={() => setReview((s) => duplicateReviewReduce(s, { type: 'back' }))} className="btn-secondary flex-1">
            {t('duplicateDialog.back')}
          </button>
          <button type="button" onClick={finalize} className="btn-danger flex-1">
            {t('duplicateDialog.replaceConfirm')}
          </button>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog open onClose={onClose} title={t('duplicateDialog.title')} size="lg">
      <div className="p-5 pt-3 space-y-4" data-review-step="choose">
        <p className="text-sm text-[color:var(--ink-soft)]">
          {t('duplicateDialog.body', { count: conflicts.length })}
        </p>
        <ul className="space-y-3 max-h-[55vh] overflow-y-auto">
          {conflicts.map((c) => {
            const old = byId.get(c.matchId);
            const choice = choiceOf(c.record.id);
            return (
              <li key={c.record.id} className="rounded-2xl border border-[var(--paper-border)] bg-[var(--paper-soft)] p-3 space-y-2">
                <div className="text-xs space-y-1">
                  <p>
                    <span className="font-semibold text-[color:var(--ink-muted)]">{t('duplicateDialog.existing')}</span>{' '}
                    {old ? summarize(old, t, i18n.language) : t('duplicateDialog.existingMissing')}
                    {old && isUserEdited(old) && (
                      <span className="ml-1 text-amber-700 font-semibold">{t('duplicateDialog.editedBadge')}</span>
                    )}
                  </p>
                  <p>
                    <span className="font-semibold text-[color:var(--accent-strong)]">{t('duplicateDialog.scanned')}</span>{' '}
                    {summarize(c.record, t, i18n.language)}
                  </p>
                  <p className="text-amber-700">
                    {c.level === 'strong' ? t('duplicateDialog.hintStrong') : t('duplicateDialog.hintLikely')}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2" role="group">
                  {CHOICES.map((key) => {
                    const selected = choice === key;
                    const disabled = key === 'replace' && !old;
                    const base = 'rounded-xl px-3 py-1.5 text-xs font-semibold border transition-colors disabled:opacity-40';
                    const tone = selected
                      ? key === 'replace'
                        ? 'bg-red-600 text-white border-red-600'
                        : 'bg-[var(--accent-strong)] text-white border-[var(--accent-strong)]'
                      : key === 'replace'
                        ? 'bg-white text-red-600 border-red-300'
                        : 'bg-white text-[color:var(--ink-soft)] border-[var(--paper-border)]';
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
        <p className="text-xs text-[color:var(--ink-muted)]">{t('duplicateDialog.closeNote')}</p>
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">{t('duplicateDialog.decideLater')}</button>
          <button type="button" onClick={handleConfirm} className="btn-primary flex-1">{t('duplicateDialog.confirm')}</button>
        </div>
      </div>
    </Dialog>
  );
}
