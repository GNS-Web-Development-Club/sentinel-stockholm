import { useCallback, useRef, useState } from 'react';
import { ToastCtx, useToasts, type Toast, type ToastKind } from './toastContext';

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const push = useCallback(
    (kind: ToastKind, text: string, ttlMs = 4000) => {
      const id = nextId.current++;
      setToasts((t) => [...t, { id, kind, text }]);
      window.setTimeout(() => dismiss(id), ttlMs);
    },
    [dismiss],
  );

  return (
    <ToastCtx.Provider value={{ toasts, push, dismiss }}>
      {children}
      <ToastLayer />
    </ToastCtx.Provider>
  );
}

// Log slips: paper notes pinned at the top of the chart, one ink rule per kind.
function ToastLayer() {
  const { toasts, dismiss } = useToasts();
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="toast" data-kind={t.kind} onClick={() => dismiss(t.id)}>
          {t.text}
        </div>
      ))}
    </div>
  );
}
