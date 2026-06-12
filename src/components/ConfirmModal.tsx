import { useEffect, useId, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  confirmDanger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({ title, message, confirmLabel = 'Confirm', confirmDanger = false, onConfirm, onCancel }: Props) {
  const titleId = useId();
  const messageId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialogRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onCancel();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} aria-hidden="true" />
      <div
        ref={dialogRef}
        className="relative bg-slate-800 border border-slate-600 rounded-2xl p-6 w-full max-w-sm shadow-2xl focus:outline-none focus:ring-2 focus:ring-blue-400"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        tabIndex={-1}
      >
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-full bg-amber-900/40 border border-amber-700/50 flex items-center justify-center flex-shrink-0" aria-hidden="true">
            <AlertTriangle className="w-4.5 h-4.5 text-amber-400" />
          </div>
          <div>
            <h3 id={titleId} className="font-semibold text-slate-100">{title}</h3>
            <p id={messageId} className="text-sm text-slate-300 mt-1 leading-relaxed">{message}</p>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 ${
              confirmDanger
                ? 'bg-red-700 hover:bg-red-600 text-white focus:ring-red-300'
                : 'bg-emerald-700 hover:bg-emerald-600 text-white focus:ring-emerald-300'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
