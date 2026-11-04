"use client";

// Smooth scrolling for the website, with GSAP's ScrollSmoother. The page still scrolls natively
// underneath (keyboard, find in page all work); the content eases after it. Off for people who
// ask for reduced motion, and on touch screens, where native scrolling feels best.
//
// The header stays outside the smoothed content (like every fixed thing on the page), so while
// smoothing is on the content is padded by the header's height. In-page links (#day and the
// like) go through the smoother, which knows where things really are.

import { gsap } from "gsap";
import { ScrollSmoother } from "gsap/ScrollSmoother";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";

/** Room left above a section reached by an in-page link (matches html's scroll-padding-top). */
const ANCHOR_GAP = 96;

export function SmoothScroll({ children }: { children: ReactNode }) {
  const wrapper = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  /** Goes to a #section through the smoother; set while the smoother is on. */
  const goToHash = useRef<((hash: string, instant?: boolean) => void) | null>(null);
  const firstPage = useRef(true);

  useEffect(() => {
    const still = window.matchMedia("(prefers-reduced-motion: reduce)");
    // Touch screens (no hover, or a coarse pointer) keep native scrolling.
    const touch = window.matchMedia("(hover: none), (pointer: coarse)").matches;
    const wrap = wrapper.current;
    const body = content.current;
    const header = document.querySelector<HTMLElement>(".site-header");
    if (still.matches || touch || !wrap || !body) return;

    gsap.registerPlugin(ScrollTrigger, ScrollSmoother);
    const smoother = ScrollSmoother.create({ wrapper: wrap, content: body, smooth: 0.8, smoothTouch: false, effects: false });

    // Keep the content clear of the header, whatever its height.
    const pad = () => body.style.setProperty("padding-top", `${header?.offsetHeight ?? 0}px`);
    pad();
    const ro = header ? new ResizeObserver(() => {
      pad();
      ScrollTrigger.refresh();
    }) : null;
    if (header) ro?.observe(header);

    const scrollToHash = (hash: string, instant = false) => {
      const target = hash.length > 1 ? document.getElementById(decodeURIComponent(hash.slice(1))) : null;
      if (target) smoother.scrollTo(target, !instant, `top ${(header?.offsetHeight ?? 0) + ANCHOR_GAP / 2}px`);
    };
    // Links to a section of this same page.
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      // HTML links and SVG links (the route rail's stops) alike.
      const a = (e.target as Element | null)?.closest?.("a[href*='#']");
      const href = a?.getAttribute("href");
      if (!href) return;
      const url = new URL(href, location.href);
      if (url.origin !== location.origin || url.pathname !== location.pathname || !url.hash) return;
      e.preventDefault();
      history.pushState(null, "", url.hash);
      scrollToHash(url.hash);
    };
    document.addEventListener("click", onClick, true);
    goToHash.current = scrollToHash;
    if (location.hash) requestAnimationFrame(() => scrollToHash(location.hash, true));

    const off = () => {
      goToHash.current = null;
      document.removeEventListener("click", onClick, true);
      ro?.disconnect();
      body.style.removeProperty("padding-top");
      smoother.kill();
    };
    // If someone turns reduced motion on while reading, go back to native scrolling.
    const onChange = () => still.matches && off();
    still.addEventListener("change", onChange);
    return () => {
      still.removeEventListener("change", onChange);
      off();
    };
  }, []);

  // A new page starts at its top (or at its #section), with its own height measured. Next's own
  // scroll to the top happens inside the smoother's wrapper, so it is undone here and done again
  // through the smoother.
  useEffect(() => {
    if (firstPage.current) {
      firstPage.current = false;
      return;
    }
    if (wrapper.current) wrapper.current.scrollTop = 0;
    const smoother = ScrollSmoother.get();
    if (!smoother) return;
    ScrollTrigger.refresh();
    if (location.hash && goToHash.current) goToHash.current(location.hash, true);
    else smoother.scrollTo(0, false);
    const frame = requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => cancelAnimationFrame(frame);
  }, [pathname]);

  return (
    <div ref={wrapper} className="smooth-wrapper">
      <div ref={content} className="smooth-content">
        {children}
      </div>
    </div>
  );
}
