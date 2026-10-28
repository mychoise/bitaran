import type { ReactNode } from "react";

/** The salesman's phone: a plain dark bezel around the screen. No notch, no status bar. */
export function PhoneScreen({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`phone w-72 rounded-device bg-board p-2.5 ${className}`.trim()}>
      <div className="flex min-h-130 flex-col overflow-hidden rounded-screen bg-cotton text-print">
        {children}
      </div>
    </div>
  );
}

/** The bar at the top of every app screen. */
export function ScreenBar({ title, aside }: { title: string; aside?: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-rule px-4 pt-4 pb-3">
      <span className="text-sm font-semibold">{title}</span>
      {aside ? <span className="text-xs text-muted">{aside}</span> : null}
    </div>
  );
}
