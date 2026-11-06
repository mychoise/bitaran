"use client";

// Pieces shared by the three shells: the demo ribbon with its dev menu, and the user menu.

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Field";
import { ConfirmDialog, useToast } from "@/components/ui/Overlay";
import { ChevronDownIcon, UserIcon } from "@/components/ui/icons";
import { useApi } from "@/lib/api/provider";
import { failureSimulated, setFailureSimulated, subscribeFailure } from "@/lib/api/mock/flags";

/** Shown only in mock mode: says the data is not real, and offers a reset. */
export function DemoRibbon() {
  const { mode } = useApi();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const failing = useSyncExternalStore(subscribeFailure, failureSimulated, () => false);
  if (mode !== "mock") return null;

  async function toggleFailure(on: boolean) {
    setFailureSimulated(on);
    await queryClient.resetQueries();
  }

  async function reset() {
    // Only ever reached in mock mode, which production refuses; the check keeps the demo data
    // out of a production build.
    if (process.env.NODE_ENV === "production") return;
    setBusy(true);
    const store = await import("@/lib/api/mock/store");
    store.resetDemoData();
    await queryClient.resetQueries();
    setBusy(false);
    setConfirm(false);
    toast("Demo data reset to the starting set.");
  }

  return (
    <div className="demo-ribbon no-print">
      <div className="flex min-h-9 items-center justify-between gap-4 px-4 py-1 lg:px-6">
        <p>
          <strong className="font-semibold">Demo data.</strong> Nothing here is real, and it is kept only in this browser.
        </p>
        <details className="relative">
          <summary className="cursor-pointer rounded-input px-2 py-1 font-medium whitespace-nowrap underline decoration-rule-2 underline-offset-2">Dev menu</summary>
          <div className="stock absolute right-0 z-40 mt-2 w-64 rounded-stock p-4">
            <p className="text-sm text-ink-2">Development tools. Not part of the product.</p>
            <Button variant="secondary" size="sm" className="mt-3 w-full" onClick={() => setConfirm(true)}>
              Reset demo data
            </Button>
            <div className="mt-4 border-t border-rule-2 pt-3">
              <Checkbox label="Simulate a connection failure" hint="Every request fails, to check the error screens. This tab only." checked={failing} onChange={(e) => toggleFailure(e.target.checked)} />
            </div>
          </div>
        </details>
      </div>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={reset}
        busy={busy}
        danger
        title="Reset demo data?"
        consequence="Every change you made to the demo data in this browser is thrown away, and the starting demo data comes back. Your login is not affected."
        confirmLabel="Reset demo data"
      />
    </div>
  );
}

/** The person's name and a menu with Change password and Log out. Escape and outside clicks close it. */
export function UserMenu({ name, roleLabel }: { name: string; roleLabel: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  async function logout() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin", cache: "no-store" });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <div ref={ref} className="relative">
      <button type="button" aria-expanded={open} aria-haspopup="true" onClick={() => setOpen((v) => !v)} className="nav-link gap-2">
        <UserIcon className="size-5" />
        <span className="max-sm:sr-only">
          {name}
          <span className="text-muted">, {roleLabel}</span>
        </span>
        <ChevronDownIcon className="size-4" />
      </button>
      {open ? (
        <div className="stock absolute right-0 z-40 mt-2 flex w-56 flex-col rounded-stock p-2">
          <Link href="/app/change-password" className="side-link" onClick={() => setOpen(false)}>
            Change password
          </Link>
          <button type="button" className="side-link w-full text-left" onClick={logout} disabled={busy}>
            {busy ? "Logging out…" : "Log out"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
