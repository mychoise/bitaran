"use client";

// Modal, Drawer, ConfirmDialog and Toast. Modal and Drawer use the native <dialog> element,
// which traps focus, closes on Escape and returns focus to what opened it.

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Button } from "./Button";
import { AlertIcon, CheckIcon, CloseIcon, InfoIcon } from "./icons";

type DialogProps = { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; drawer?: boolean };

function Dialog({ open, onClose, title, children, footer, drawer = false }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={`dialog ${drawer ? "dialog-drawer" : ""}`}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose(); // a click on the scrim
      }}
    >
      {open ? (
        <div className={`flex flex-col ${drawer ? "h-full" : ""}`}>
          <div className="flex items-start justify-between gap-4 border-b border-rule px-6 py-5">
            <h2 id={titleId} className="text-title">
              {title}
            </h2>
            <button type="button" onClick={onClose} className="pw-toggle -mr-2 flex size-11 items-center justify-center rounded-input" aria-label="Close">
              <CloseIcon className="size-5" />
            </button>
          </div>
          <div className={`px-6 py-5 ${drawer ? "flex-1 overflow-y-auto" : ""}`}>{children}</div>
          {footer ? <div className="flex flex-wrap justify-end gap-3 border-t border-rule px-6 py-4">{footer}</div> : null}
        </div>
      ) : null}
    </dialog>
  );
}

export const Modal = (p: Omit<DialogProps, "drawer">) => <Dialog {...p} />;
export const Drawer = (p: Omit<DialogProps, "drawer">) => <Dialog {...p} drawer />;

/**
 * For destructive or irreversible actions. Says what will happen; the confirm button names the
 * action ("Mark as bounced"), never a bare "OK".
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  consequence,
  confirmLabel,
  busy = false,
  danger = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  consequence: ReactNode;
  confirmLabel: string;
  busy?: boolean;
  danger?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Go back
          </Button>
          <Button onClick={onConfirm} loading={busy} loadingLabel="Working…">
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex gap-3">
        {danger ? <AlertIcon className="mt-0.5 size-5 shrink-0 text-error" /> : <InfoIcon className="mt-0.5 size-5 shrink-0" />}
        <div className="text-ink">{consequence}</div>
      </div>
    </Modal>
  );
}

// ---- toasts ------------------------------------------------------------------------------

type Toast = { id: number; message: string; tone: "info" | "success" };
const ToastContext = createContext<(message: string, tone?: Toast["tone"]) => void>(() => {});

/** Short confirmations of something that happened. Not for errors that need action. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const show = useCallback((message: string, tone: Toast["tone"] = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div role="status" aria-live="polite" className="no-print pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:items-end">
        {toasts.map((t) => (
          <div key={t.id} className="toast pointer-events-auto">
            {t.tone === "success" ? <CheckIcon className="mt-0.5 size-5 shrink-0" /> : <InfoIcon className="mt-0.5 size-5 shrink-0" />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
