import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { EndedNote } from "@/components/auth/EndedNote";
import { ArrowRightIcon } from "@/components/ui/icons";
import { config } from "@/config";

export const metadata: Metadata = { title: "Sign in" };

const choices = [
  { href: "/login/staff", title: "I work here", line: "For the owner, managers and salesmen of a wholesale business." },
  { href: "/login/shop", title: "I'm a shop", line: "For pasals that buy from a wholesaler and want to see their balance." },
];

/** The chooser: staff and shops sign in on separate forms. */
export default function LoginChooserPage() {
  return (
    <AuthShell>
      <div>
        <h1 className="text-display-s">Sign in</h1>
        <p className="lead mt-4 text-ink-2">Choose how you use Bitaran.</p>
        <Suspense fallback={null}>
          <EndedNote />
        </Suspense>
        <ul className="m-0 mt-10 flex list-none flex-col gap-5 p-0">
          {choices.map((c) => (
            <li key={c.href}>
              <Link href={c.href} className="choice stock flex items-center justify-between gap-6 rounded-stock p-7 no-underline">
                <span>
                  <span className="block text-title font-semibold">{c.title}</span>
                  <span className="mt-2 block text-ink-2">{c.line}</span>
                </span>
                <ArrowRightIcon className="choice-arrow size-6 shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-10 border-t border-rule-2 pt-6">
          <h2 className="text-title tracking-normal">No account yet?</h2>
          <p className="mt-2 text-ink-2">
            There is no sign-up form. Staff and shops get their login from the wholesale business they work with or buy from.
          </p>
          <p className="mt-3 text-ink-2">
            Running a wholesale business?{" "}
            <Link href={config.demoUrl} className="text-link whitespace-nowrap">
              Request a demo
            </Link>
          </p>
        </div>
      </div>
    </AuthShell>
  );
}
