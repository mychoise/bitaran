"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Clears the session through the logout route handler, then goes to the login chooser. */
export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function logout() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin", cache: "no-store" });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }
  return (
    <button type="button" onClick={logout} disabled={busy} aria-busy={busy || undefined} className="btn btn-card">
      {busy ? "Logging out…" : "Log out"}
    </button>
  );
}
