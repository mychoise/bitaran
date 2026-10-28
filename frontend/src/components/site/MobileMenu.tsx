"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CloseIcon, MenuIcon } from "@/components/ui/icons";
import type { NavItem } from "@/lib/nav";

type Props = { items: NavItem[]; appUrl: string; demoUrl: string };

/** Collapsed menu for narrow screens. Escape closes it and returns focus to the toggle. */
export function MobileMenu({ items, appUrl, demoUrl }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="xl:hidden">
      <button
        ref={toggleRef}
        type="button"
        className="btn btn-card px-3"
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <CloseIcon className="size-5" /> : <MenuIcon className="size-5" />}
        <span>Menu</span>
      </button>
      <nav
        id="mobile-menu"
        aria-label="Main"
        hidden={!open}
        className="absolute inset-x-0 top-full border-b-2 border-ink bg-paper-2"
      >
        <ul className="m-0 flex list-none flex-col px-gutter py-4">
          {items.map((item) => (
            <li key={item.href} className="border-b border-rule last:border-b-0">
              <Link
                href={item.href}
                aria-current={pathname === item.href ? "page" : undefined}
                onClick={() => setOpen(false)}
                className="flex min-h-12 items-center text-lg no-underline aria-[current=page]:font-semibold"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-3 px-gutter pb-6">
          <a href={appUrl} className="btn btn-card" onClick={() => setOpen(false)}>
            Login
          </a>
          <Link href={demoUrl} className="btn btn-ink" onClick={() => setOpen(false)}>
            Request a demo
          </Link>
        </div>
      </nav>
    </div>
  );
}
