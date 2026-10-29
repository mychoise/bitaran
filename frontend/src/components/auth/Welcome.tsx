import Link from "next/link";
import { LogoutButton } from "./LogoutButton";
import { displayName, type Profile } from "@/lib/auth/types";

const ROLE_LABEL = { owner: "Owner", manager: "Manager", salesman: "Salesman" } as const;

/** The placeholder landing page: who is signed in, and the two things they can do for now. */
export function Welcome({ profile }: { profile: Profile }) {
  const role = profile.type === "shop" ? "Shop" : ROLE_LABEL[profile.role];
  return (
    <div className="hero-text max-w-2xl">
      <h1 className="text-display-s">Welcome, {displayName(profile)}</h1>
      <p className="lead mt-4 text-ink-2">
        {role}
        {profile.type === "shop" ? `, buying from ${profile.businessName}` : ` at ${profile.businessName}`}
      </p>
      <p className="stock mt-10 rounded-stock px-6 py-5 text-lg">This area is coming next.</p>
      <div className="mt-10 flex flex-wrap items-center gap-6">
        <LogoutButton />
        <Link href="/app/change-password" className="text-link">
          Change password
        </Link>
      </div>
    </div>
  );
}
