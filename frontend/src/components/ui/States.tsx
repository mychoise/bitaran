import type { ReactNode } from "react";
import { Button } from "./Button";
import { AlertIcon } from "./icons";
import { Skeleton } from "./Display";

/** Nothing to show yet: what is empty, why it matters, one action. No illustrations. */
export function EmptyState({ title, line, action, icon }: { title: string; line: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 py-10">
      {icon ? <span className="text-muted">{icon}</span> : null}
      <h2 className="text-title tracking-normal">{title}</h2>
      <p className="max-w-prose text-ink-2">{line}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/** Something failed: say so plainly, and offer Retry. */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-stock border-2 border-error bg-error-soft p-6">
      <p className="flex items-center gap-2 font-semibold text-error">
        <AlertIcon className="size-5" />
        This did not load
      </p>
      <p className="text-ink">{message}</p>
      {onRetry ? (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
  );
}

/** Lines of placeholder while data loads. Announced once, politely. */
export function LoadingState({ lines = 4, label = "Loading" }: { lines?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-3 py-4">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={`h-5 ${i % 3 === 2 ? "w-1/2" : "w-full"}`} />
      ))}
    </div>
  );
}
