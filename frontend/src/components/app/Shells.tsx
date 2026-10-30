"use client";

// The three app shells, each built for phones and desktops alike. Manager/owner: a sidebar from
// lg, a Menu drawer below it (too many sections for tabs). Salesman and shop: a bottom tab bar on
// phones, the same sidebar from lg. All use the website's slab, wordmark and coral marker.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Badge, StatusBadge } from "@/components/ui/Display";
import { Drawer } from "@/components/ui/Overlay";
import { MenuIcon } from "@/components/ui/icons";
import { useApi, useApiQuery } from "@/lib/api/provider";
import { DemoRibbon, UserMenu } from "./Chrome";
import { isCurrent, managerNavFor, salesmanNav, shopNav, type NavEntry } from "./nav";
import { ROLE_LABEL } from "./labels";
import { NavIcon } from "./NavIcon";

function useIdentity() {
  const { viewer } = useApi();
  return { name: viewer.name, roleLabel: viewer.type === "shop" ? "Shop" : ROLE_LABEL[viewer.role] };
}

function BusinessName() {
  const q = useApiQuery(["business"], (api) => api.business.get());
  return <span className="truncate text-ink-2">{q.data?.name ?? " "}</span>;
}

function SideNav({ items, home, onNavigate }: { items: NavEntry[]; home: string; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <ul className="m-0 flex list-none flex-col gap-1 p-0">
      {items.map((item) => (
        <li key={item.href}>
          <Link href={item.href} className="side-link" aria-current={isCurrent(item.href, pathname, home) ? "page" : undefined} onClick={onNavigate}>
            <NavIcon name={item.icon} />
            {item.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

// ---- owner and manager -------------------------------------------------------------------

export function ManagerShell({ children }: { children: ReactNode }) {
  const { viewer } = useApi();
  const { name, roleLabel } = useIdentity();
  const [menuOpen, setMenuOpen] = useState(false);
  const items = managerNavFor(viewer.type === "staff" ? viewer.role : "manager");
  return (
    <div className="flex min-h-svh flex-col">
      <header className="no-print sticky top-0 z-30 border-b-2 border-ink bg-paper-2">
        <div className="flex h-16 items-center gap-4 px-4 lg:px-6">
          <button type="button" className="btn btn-card btn-sm px-3 lg:hidden" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}>
            <MenuIcon className="size-5" />
            <span>Menu</span>
          </button>
          <Link href="/app/manager" className="wordmark no-underline" aria-label="Bitaran, today">
            Bitaran
          </Link>
          <span className="hidden min-w-0 border-l border-rule-2 pl-4 md:block">
            <BusinessName />
          </span>
          <span className="ml-auto">
            <UserMenu name={name} roleLabel={roleLabel} />
          </span>
        </div>
      </header>
      <DemoRibbon />
      <div className="flex flex-1">
        <nav aria-label="Main" className="no-print hidden w-64 shrink-0 border-r-2 border-ink bg-paper-2 p-4 lg:block">
          <div className="sticky top-20">
            <SideNav items={items} home="/app/manager" />
          </div>
        </nav>
        <main id="main" className="min-w-0 flex-1 px-4 py-8 lg:px-10">
          {children}
        </main>
      </div>
      <Drawer open={menuOpen} onClose={() => setMenuOpen(false)} title="Menu">
        <nav aria-label="Main">
          <SideNav items={items} home="/app/manager" onNavigate={() => setMenuOpen(false)} />
        </nav>
      </Drawer>
    </div>
  );
}

// ---- salesman and shop: bottom tabs on phones, a sidebar on desktop ---------------------

function DayStatus() {
  const q = useApiQuery(["dayPlans", "today"], (api) => api.dayPlans.today());
  if (q.isPending) return <Badge>Loading day…</Badge>;
  if (q.isError) return <Badge tone="danger">Day not loaded</Badge>;
  if (!q.data) return <Badge>No route today</Badge>;
  return <StatusBadge status={q.data.status} />;
}

/** Phones get a fixed bottom tab bar; from lg the same entries move to the manager's sidebar. */
function TabbedShell({ items, home, homeLabel, status, children }: { items: NavEntry[]; home: string; homeLabel: string; status?: ReactNode; children: ReactNode }) {
  const pathname = usePathname();
  const { name, roleLabel } = useIdentity();
  return (
    <div className="flex min-h-svh flex-col pb-20 lg:pb-0">
      <header className="no-print sticky top-0 z-30 border-b-2 border-ink bg-paper-2">
        <div className="flex h-14 items-center gap-3 px-4 lg:h-16 lg:gap-4 lg:px-6">
          <Link href={home} className="wordmark text-lg no-underline lg:text-xl" aria-label={`Bitaran, ${homeLabel}`}>
            Bitaran
          </Link>
          <span className="hidden min-w-0 border-l border-rule-2 pl-4 lg:block">
            <BusinessName />
          </span>
          {status}
          <span className="ml-auto">
            <UserMenu name={name} roleLabel={roleLabel} />
          </span>
        </div>
      </header>
      <DemoRibbon />
      <div className="flex flex-1">
        <nav aria-label="Main" className="no-print hidden w-60 shrink-0 border-r-2 border-ink bg-paper-2 p-4 lg:block">
          <div className="sticky top-20">
            <SideNav items={items} home={home} />
          </div>
        </nav>
        <main id="main" className="min-w-0 flex-1 px-4 py-6 lg:px-10 lg:py-8">
          {children}
        </main>
      </div>
      <nav aria-label="Main" className="no-print fixed inset-x-0 bottom-0 z-30 border-t-2 border-ink bg-paper-2 lg:hidden">
        <ul className="m-0 flex list-none p-0">
          {items.map((item) => (
            <li key={item.href} className="flex min-w-0 flex-1">
              <Link href={item.href} className="bottom-tab" aria-current={isCurrent(item.href, pathname, home) ? "page" : undefined}>
                <NavIcon name={item.icon} className="size-6" />
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

export function SalesmanShell({ children }: { children: ReactNode }) {
  return (
    <TabbedShell items={salesmanNav} home="/app/salesman" homeLabel="today" status={<DayStatus />}>
      {children}
    </TabbedShell>
  );
}

export function ShopShell({ children }: { children: ReactNode }) {
  return (
    <TabbedShell items={shopNav} home="/app/shop" homeLabel="overview">
      {children}
    </TabbedShell>
  );
}
