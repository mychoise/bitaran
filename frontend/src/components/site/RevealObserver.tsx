"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * The site's one scroll reveal. Elements marked data-reveal are visible by default; the CSS hides
 * them only under html.js (set before paint in the layout), and this observer adds .is-in as each
 * one scrolls into view. A CSS fail-safe shows everything after a few seconds if this never runs.
 */
export function RevealObserver() {
  const pathname = usePathname();

  useEffect(() => {
    const items = document.querySelectorAll<HTMLElement>("[data-reveal]:not(.is-in)");
    if (!("IntersectionObserver" in window)) {
      items.forEach((el) => el.classList.add("is-in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [pathname]);

  return null;
}
