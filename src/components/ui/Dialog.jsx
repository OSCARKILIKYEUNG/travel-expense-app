import { useEffect, useRef } from 'react';
import { X } from './Icons';

const dialogEscapeStack = [];

export default function Dialog({ open, onClose, title, children, size = 'md' }) {
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
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      const index = dialogEscapeStack.indexOf(entry);
      if (index >= 0) dialogEscapeStack.splice(index, 1);
      if (dialogEscapeStack.length === 0) {
        document.body.style.overflow = previousOverflow || '';
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
      aria-label={title}
    >
      <div
        ref={panelRef}
        className={`dialog-panel ${widthClass}`}
        style={{ overscrollBehavior: 'contain' }}
      >
        {title && (
          <div className="flex items-center justify-between p-5 pb-0">
            <h2 className="text-xl font-bold text-slate-900">{title}</h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              aria-label="關閉"
            >
              <X size={20} />
            </button>
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
