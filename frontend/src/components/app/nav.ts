// Navigation for each audience. Sections not built yet open a "comes in a later step" page.

import type { StaffRole } from "@/lib/api/types";

export type NavEntry = { href: string; label: string; icon: string; ownerOnly?: boolean; /** Has its own route folder. */ built?: boolean };

export const managerNav: NavEntry[] = [
  { href: "/app/manager", label: "Today", icon: "home" },
  { href: "/app/manager/plans", label: "Day plans", icon: "route" },
  { href: "/app/manager/sales", label: "Sales", icon: "receipt" },
  { href: "/app/manager/payments", label: "Payments", icon: "wallet" },
  { href: "/app/manager/shops", label: "Shops", icon: "store" },
  { href: "/app/manager/products", label: "Products and stock", icon: "box", built: true },
  { href: "/app/manager/returns", label: "Returns and write-offs", icon: "return" },
  { href: "/app/manager/expenses", label: "Expenses", icon: "wallet" },
  { href: "/app/manager/photos", label: "Visit photos", icon: "camera" },
  { href: "/app/manager/reports", label: "Reports", icon: "chart" },
  { href: "/app/manager/staff", label: "Staff", icon: "users", built: true },
  { href: "/app/manager/settings", label: "Settings", icon: "settings", ownerOnly: true, built: true },
];

export const managerNavFor = (role: StaffRole) => managerNav.filter((n) => !n.ownerOnly || role === "owner");

export const salesmanNav: NavEntry[] = [
  { href: "/app/salesman", label: "Today", icon: "home" },
  { href: "/app/salesman/shops", label: "Shops", icon: "store" },
  { href: "/app/salesman/sell", label: "Sell", icon: "cart" },
  { href: "/app/salesman/stock", label: "Stock", icon: "box" },
  { href: "/app/salesman/more", label: "More", icon: "more" },
];

export const shopNav: NavEntry[] = [
  { href: "/app/shop", label: "Overview", icon: "home" },
  { href: "/app/shop/statement", label: "Statement", icon: "receipt" },
  { href: "/app/shop/invoices", label: "Invoices", icon: "receipt" },
  { href: "/app/shop/payments", label: "Payments", icon: "wallet" },
  { href: "/app/shop/returns", label: "Returns", icon: "return" },
];

/** The section names each area's "later step" catch-all still answers (built ones have their own route). */
export const sectionsOf = (nav: NavEntry[], base: string) => nav.filter((n) => !n.built).map((n) => n.href.slice(base.length + 1)).filter(Boolean);

/** Whether a nav entry is the current page (the area home matches only exactly). */
export const isCurrent = (href: string, pathname: string, home: string) => (href === home ? pathname === home : pathname === href || pathname.startsWith(`${href}/`));
