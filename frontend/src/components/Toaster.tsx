import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { subscribeToNotices, type Notice } from '../lib/notify';

const AUTO_DISMISS_MS = 6000;

const styles: Record<Notice['kind'], string> = {
  error: 'bg-rose-50 border-rose-200 text-rose-800',
  success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  info: 'bg-indigo-50 border-indigo-200 text-indigo-800',
};

const icons = {
  error: AlertCircle,
  success: CheckCircle2,
  info: Info,
};

export const Toaster: React.FC = () => {
  const [notices, setNotices] = useState<Notice[]>([]);

  useEffect(
    () =>
      subscribeToNotices((notice) => {
        setNotices((prev) => [...prev, notice]);
        window.setTimeout(
          () => setNotices((prev) => prev.filter((n) => n.id !== notice.id)),
          AUTO_DISMISS_MS,
        );
      }),
    [],
  );

  if (notices.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 left-4 sm:left-auto sm:w-96 z-[60] space-y-2" aria-live="polite">
      {notices.map((notice) => {
        const Icon = icons[notice.kind];
        return (
          <div
            key={notice.id}
            role={notice.kind === 'error' ? 'alert' : 'status'}
            className={`p-3 pr-2 rounded-xl border shadow-lg flex items-start gap-3 text-sm ${styles[notice.kind]}`}
          >
            <Icon className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
            <p className="flex-1">{notice.text}</p>
            <button
              onClick={() => setNotices((prev) => prev.filter((n) => n.id !== notice.id))}
              aria-label="Dismiss message"
              className="p-1.5 rounded-lg hover:bg-black/5"
              style={{ minHeight: 0 }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
