import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Dialog from '../ui/Dialog';
import { getExpenseStoreDisplay } from '../../utils/displayNames';
import { describeHashConflict, hashDecisionsFromChoices } from '../../utils/sourceHash';

function conflictMessage(conflict, t, lang) {
  const described = describeHashConflict(conflict);
  if (described.sameFile) return t('upload.dupHashSameFileBody');
  const store = String(getExpenseStoreDisplay(conflict.match, lang, t) || '').trim() || described.store;
  return t('upload.dupHashBody', { store, date: described.date });
}

const CHOICES = ['skip', 'scan'];

/**
 * Exact-file prompt shown before parseReceipt. Default choice is skip (no scan credit).
 * Closing the dialog does not confirm scans; the parent treats close as skip-all.
 *
 * @param {{
 *   open: boolean,
 *   conflicts: Array<{ file?: File, hash: string, index: number, match: object|null, sameFile?: boolean }>,
 *   onConfirm: (decisions: Record<string, 'skip'|'scan'>) => void,
 *   onClose: () => void,
 * }} props
 */
export default function HashDuplicateDialog({ open, conflicts, onConfirm, onClose }) {
  const { t, i18n } = useTranslation();
  const sessionKey = open ? (conflicts || []).map((c) => `${c?.index}:${c?.hash}`).join('|') : '';
  const [choices, setChoices] = useState({});
  const [seenSession, setSeenSession] = useState(sessionKey);
  let choicesNow = choices;
  if (seenSession !== sessionKey) {
    choicesNow = {};
    setSeenSession(sessionKey);
    setChoices(choicesNow);
  }

  if (!open) return null;

  const choiceOf = (index) => (choicesNow[index] === 'scan' ? 'scan' : 'skip');

  return (
    <Dialog open onClose={onClose} title={t('upload.dupHashTitle')} size="md">
      <div className="space-y-4" data-hash-review="choose">
        <ul className="space-y-3 max-h-[55vh] overflow-y-auto">
          {(conflicts || []).map((conflict) => {
            const choice = choiceOf(conflict.index);
            return (
              <li
                key={`${conflict.index}:${conflict.hash}`}
                className="rounded-2xl border border-line bg-cream-soft p-3 space-y-2"
              >
                <p className="text-sm text-ink-soft">{conflictMessage(conflict, t, i18n.language)}</p>
                {conflict.file?.name && (
                  <p className="text-meta text-ink-muted">{conflict.file.name}</p>
                )}
                <div className="flex flex-wrap gap-2" role="group">
                  {CHOICES.map((key) => {
                    const selected = choice === key;
                    const base = 'inline-flex min-h-11 min-w-11 items-center justify-center whitespace-nowrap rounded-xl px-3 py-2 text-xs font-semibold border transition-colors';
                    const tone = selected
                      ? 'bg-teal-strong text-white border-teal-strong'
                      : 'bg-white text-ink-soft border-line';
                    return (
                      <button
                        key={key}
                        type="button"
                        aria-pressed={selected}
                        data-choice={key}
                        onClick={() => setChoices((prev) => ({ ...prev, [conflict.index]: key }))}
                        className={`${base} ${tone}`}
                      >
                        {t(`upload.dupHash${key === 'skip' ? 'Skip' : 'Scan'}`)}
                      </button>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          data-choice="continue"
          onClick={() => onConfirm(hashDecisionsFromChoices(conflicts, choicesNow))}
          className="btn-primary min-h-11 w-full whitespace-nowrap"
        >
          {t('upload.dupHashContinue')}
        </button>
      </div>
    </Dialog>
  );
}
