// Navigation for each audience. Every section has its own route folder.

import type { StaffRole } from "@/lib/api/types";

export type NavEntry = { href: string; label: string; icon: string; ownerOnly?: boolean; /** Has its own route folder. */ built?: boolean };

// Each `label` is a key into the "Nav" message namespace, resolved where the nav is rendered.

export const managerNav: NavEntry[] = [
  { href: "/app/manager", label: "today", icon: "home" },
  { href: "/app/manager/day-plans", label: "dayPlans", icon: "route", built: true },
  { href: "/app/manager/sales", label: "sales", icon: "receipt", built: true },
  { href: "/app/manager/orders", label: "orders", icon: "cart", built: true },
  { href: "/app/manager/payments", label: "payments", icon: "wallet", built: true },
  { href: "/app/manager/shops", label: "shops", icon: "store", built: true },
  { href: "/app/manager/routes", label: "routes", icon: "route", built: true },
  { href: "/app/manager/products", label: "productsAndStock", icon: "box", built: true },
  { href: "/app/manager/returns", label: "returns", icon: "return", built: true },
  { href: "/app/manager/write-offs", label: "writeOffs", icon: "box", built: true },
  { href: "/app/manager/expenses", label: "expenses", icon: "wallet", built: true },
  { href: "/app/manager/photos", label: "visitPhotos", icon: "camera", built: true },
  { href: "/app/manager/reports", label: "reports", icon: "chart", built: true },
  { href: "/app/manager/staff", label: "staff", icon: "users", built: true },
  { href: "/app/manager/settings", label: "settings", icon: "settings", ownerOnly: true, built: true },
];

export const managerNavFor = (role: StaffRole) => managerNav.filter((n) => !n.ownerOnly || role === "owner");

export const salesmanNav: NavEntry[] = [
  { href: "/app/salesman", label: "today", icon: "home" },
  { href: "/app/salesman/shops", label: "shops", icon: "store", built: true },
  { href: "/app/salesman/today", label: "sales", icon: "receipt", built: true },
  { href: "/app/salesman/stock", label: "stock", icon: "box", built: true },
  { href: "/app/salesman/more", label: "more", icon: "more", built: true },
];

export const shopNav: NavEntry[] = [
  { href: "/app/shop", label: "home", icon: "home" },
  { href: "/app/shop/statement", label: "statement", icon: "receipt", built: true },
  { href: "/app/shop/invoices", label: "invoices", icon: "receipt", built: true },
  { href: "/app/shop/payments", label: "payments", icon: "wallet", built: true },
  { href: "/app/shop/returns", label: "returns", icon: "return", built: true },
  { href: "/app/shop/profile", label: "profile", icon: "store", built: true },
];

/** Whether a nav entry is the current page (the area home matches only exactly). */
export const isCurrent = (href: string, pathname: string, home: string) => (href === home ? pathname === home : pathname === href || pathname.startsWith(`${href}/`));
