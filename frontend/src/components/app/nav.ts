// Navigation for each audience. Every section has its own route folder.

import type { StaffRole } from "@/lib/api/types";

export type NavEntry = { href: string; label: string; icon: string; ownerOnly?: boolean; /** Has its own route folder. */ built?: boolean };

export const managerNav: NavEntry[] = [
  { href: "/app/manager", label: "Today", icon: "home" },
  { href: "/app/manager/day-plans", label: "Day plans", icon: "route", built: true },
  { href: "/app/manager/sales", label: "Sales", icon: "receipt", built: true },
  { href: "/app/manager/payments", label: "Payments", icon: "wallet", built: true },
  { href: "/app/manager/shops", label: "Shops", icon: "store", built: true },
  { href: "/app/manager/routes", label: "Routes", icon: "route", built: true },
  { href: "/app/manager/products", label: "Products and stock", icon: "box", built: true },
  { href: "/app/manager/returns", label: "Returns", icon: "return", built: true },
  { href: "/app/manager/write-offs", label: "Write-offs", icon: "box", built: true },
  { href: "/app/manager/expenses", label: "Expenses", icon: "wallet", built: true },
  { href: "/app/manager/photos", label: "Visit photos", icon: "camera", built: true },
  { href: "/app/manager/reports", label: "Reports", icon: "chart", built: true },
  { href: "/app/manager/staff", label: "Staff", icon: "users", built: true },
  { href: "/app/manager/settings", label: "Settings", icon: "settings", ownerOnly: true, built: true },
];

export const managerNavFor = (role: StaffRole) => managerNav.filter((n) => !n.ownerOnly || role === "owner");

export const salesmanNav: NavEntry[] = [
  { href: "/app/salesman", label: "Today", icon: "home" },
  { href: "/app/salesman/shops", label: "Shops", icon: "store", built: true },
  { href: "/app/salesman/today", label: "Sales", icon: "receipt", built: true },
  { href: "/app/salesman/stock", label: "Stock", icon: "box", built: true },
  { href: "/app/salesman/more", label: "More", icon: "more", built: true },
];

export const shopNav: NavEntry[] = [
  { href: "/app/shop", label: "Home", icon: "home" },
  { href: "/app/shop/statement", label: "Statement", icon: "receipt", built: true },
  { href: "/app/shop/invoices", label: "Invoices", icon: "receipt", built: true },
  { href: "/app/shop/payments", label: "Payments", icon: "wallet", built: true },
  { href: "/app/shop/returns", label: "Returns", icon: "return", built: true },
  { href: "/app/shop/profile", label: "Profile", icon: "store", built: true },
];

/** Whether a nav entry is the current page (the area home matches only exactly). */
export const isCurrent = (href: string, pathname: string, home: string) => (href === home ? pathname === home : pathname === href || pathname.startsWith(`${href}/`));
