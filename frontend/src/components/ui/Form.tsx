import Link from "next/link";
import { AlertIcon, ChevronLeftIcon } from "./icons";

/** The way back to a list from one of its records or forms. */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="no-print mb-4 inline-flex items-center gap-1 text-ink-2 hover:text-ink">
      <ChevronLeftIcon className="size-4" />
      {label}
    </Link>
  );
}

/** A problem with the whole form (not one field), announced when it appears. */
export function FormProblem({ message }: { message: string | null }) {
  return (
    <p role="alert" className={message ? "mt-4 flex items-start gap-2 font-medium text-error" : "visually-hidden"}>
      {message ? (
        <>
          <AlertIcon className="mt-0.5 size-5 shrink-0" />
          {message}
        </>
      ) : null}
    </p>
  );
}
