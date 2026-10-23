import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from './Icons';

const dialogEscapeStack = [];
// Saved when the first dialog opens and restored when the last one closes, so
// nested dialogs unmounting in any order can't leave the page scroll-locked.
let bodyOverflowBeforeDialogs = '';

export default function Dialog({ open, onClose, title, ariaLabel, children, size = 'md' }) {
  const { t } = useTranslation();
  const panelRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const entry = { id: Symbol('dialog') };
    dialogEscapeStack.push(entry);
    const handler = (e) => {
      if (e.key !== 'Escape') return;
      if (dialogEscapeStack[dialogEscapeStack.length - 1] !== entry) return;
      e.preventDefault();
      onCloseRef.current?.();
    };
    document.addEventListener('keydown', handler);
    if (dialogEscapeStack.length === 1) bodyOverflowBeforeDialogs = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      const index = dialogEscapeStack.indexOf(entry);
      if (index >= 0) dialogEscapeStack.splice(index, 1);
      if (dialogEscapeStack.length === 0) {
        document.body.style.overflow = bodyOverflowBeforeDialogs || '';
      }
    };
  }, [open]);

  if (!open) return null;

  const widthClass = size === 'lg' ? 'sm:max-w-2xl' : size === 'sm' ? 'sm:max-w-sm' : 'sm:max-w-lg';

  return (
    <div
      className="dialog-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label={title || ariaLabel}
    >
      <div
        ref={panelRef}
        className={`dialog-panel ${widthClass}`}
        style={{ overscrollBehavior: 'contain' }}
      >
        {title && (
          <div className="flex items-center justify-between px-4 pt-4 pb-0 sm:px-5 sm:pt-5">
            <h2 className="min-w-0 truncate text-xl font-normal text-ink">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="btn-icon h-11 w-11 min-h-11 min-w-11 shrink-0"
              aria-label={t('common.close', { defaultValue: '關閉' })}
            >
              <X size={20} />
            </button>
          </div>
        )}
        <div className="p-4 sm:p-5">{children}</div>
      </div>
    </div>
  );
}
