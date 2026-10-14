import { createContext, useContext } from 'react';

export type ToastKind = 'info' | 'error' | 'success';
export interface Toast {
  id: number;
  kind: ToastKind;
  text: string;
}

export interface ToastCtxValue {
  toasts: Toast[];
  push: (kind: ToastKind, text: string, ttlMs?: number) => void;
  dismiss: (id: number) => void;
}

export const ToastCtx = createContext<ToastCtxValue | null>(null);

export function useToasts() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToasts must be used inside <ToastProvider>');
  return ctx;
}
