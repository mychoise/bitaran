"use client";

// A salesman's route through Pokhara, as a small rail fixed in the left margin of every page of
// the website. Each page rides a different route, and each stop on it is one section of the page:
// the marker reaches a stop as that section comes into view, and clicking a stop goes there.
// Machhapuchhre at the top, Phewa Lake at the bottom. Shown where the margin is wide enough.

import { gsap } from "gsap";
import { ScrollSmoother } from "gsap/ScrollSmoother";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

/** A different part of Pokhara for each page, in riding order. */
const ROUTES: Record<string, string[]> = {
  "/": ["Bagar", "Mahendrapul", "Ramghat", "Bindabasini", "Miruwa", "Nadipur", "Bhimkalipatan", "Batulechaur", "Kahun", "Lamachaur"],
  "/features": ["Lakeside", "Baidam", "Gaurighat", "Damside", "Pardi", "Birauta", "Chhorepatan", "Phewa Dam", "Bulaudi", "Hyangja"],
  "/services": ["Prithvi Chowk", "Nayabazar", "Srijana Chowk", "Masbar", "Ranipauwa", "Rambazar", "Simalchaur", "Phulbari", "Zero Kilometer", "Bijayapur"],
  "/how-it-works": ["Chipledhunga", "Bhairab Tole", "Nala Mukh", "Bhimsen Tole", "Ganesh Tole", "Tersapatti", "Purano Bazar", "Bagale Tole", "Ratopairo", "Kundahar"],
  "/pricing": ["Talchowk", "Lekhnath", "Sishuwa", "Begnas", "Rupa", "Kalika", "Khudi", "Majhthana", "Arba", "Hemja"],
  "/contact": ["Sarangkot", "Kaskikot", "Bhumdi", "Pumdi", "Kristi", "Sedi Bagar", "Dhikur Pokhari", "Naudanda", "Lumle", "Bhadaure"],
};
const FALLBACK = ["Ratna Chowk", "Deep", "Bagbazar", "Amarsingh Chowk", "Hospital Chowk", "Pokhara Bus Park"];

const W = 52;
const H = 420;
const ROAD_TOP = 56;
const ROAD_BOTTOM = 372;
const LEFT = 12;
const RIGHT = 28;
/** Header height, kept clear when deciding which section is being read. */
const TOP_CLEAR = 80;

type Section = { id: string; title: string; el: HTMLElement };

/** Shown on the page now. Next keeps pages visited earlier in the document, hidden, to come back fast. */
const isShown = (el: HTMLElement) => el.isConnected && el.getClientRects().length > 0;

/** The page's own sections, in order: each top-level section in <main> that names its heading. */
function readSections(): Section[] {
  return [...document.querySelectorAll<HTMLElement>("main section[aria-labelledby]")]
    .filter((el) => isShown(el) && !el.parentElement?.closest("main section"))
    .flatMap((el) => {
      const id = el.getAttribute("aria-labelledby") ?? "";
      const heading = document.getElementById(id);
      return heading ? [{ id, title: heading.textContent?.trim() ?? "", el }] : [];
    });
}

/** How far down the page the reader is, 0 to 1. Follows the smoothed scroll when it is on. */
function pageProgress(): number {
  const smoother = ScrollSmoother.get();
  if (smoother) return smoother.progress;
  const max = document.documentElement.scrollHeight - window.innerHeight;
  return max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
}

export function ScrollRoute() {
  const pathname = usePathname();
  const [sections, setSections] = useState<Section[]>([]);

  // Find the page's sections, and again whenever the page's content changes (a new page can
  // arrive a moment after the address does, and parts of a page can stream in).
  const [stale, setStale] = useState(0);
  const onStale = useCallback(() => setStale((n) => n + 1), []);
  useEffect(() => {
    const main = document.querySelector("main");
    let frame = 0;
    const read = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() =>
        setSections((prev) => {
          const next = readSections();
          return next.length === prev.length && next.every((s, i) => s.el === prev[i].el) ? prev : next;
        }),
      );
    };
    read();
    const mo = main ? new MutationObserver(read) : null;
    if (main) mo?.observe(main, { childList: true, subtree: true });
    return () => {
      mo?.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [pathname, stale]);

  if (sections.length < 2) return null;
  const places = ROUTES[pathname] ?? FALLBACK;
  return <Rail key={pathname} sections={sections} places={sections.map((_, i) => places[i % places.length])} onStale={onStale} />;
}

function Rail({ sections, places, onStale }: { sections: Section[]; places: string[]; onStale: () => void }) {
  const road = useRef<SVGPathElement>(null);
  const line = useRef<SVGPathElement>(null);
  const marker = useRef<SVGGElement>(null);
  const dots = useRef<(SVGCircleElement | null)[]>([]);
  const label = useRef<SVGTextElement>(null);
  const count = useRef<SVGTextElement>(null);
  /** A stop someone clicked stays current until they scroll again themselves. On a short page
      the scroll can end with several sections in view; the one asked for is the one marked. */
  const chosen = useRef<number | null>(null);

  const n = sections.length;
  const seg = (ROAD_BOTTOM - ROAD_TOP) / (n - 1);
  const stops = places.map((place, i) => ({ place, x: i % 2 === 0 ? LEFT : RIGHT, y: ROAD_TOP + i * seg }));
  const d = stops
    .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `C ${stops[i - 1].x} ${stops[i - 1].y + seg * 0.55}, ${p.x} ${p.y - seg * 0.55}, ${p.x} ${p.y}`))
    .join(" ");

  useEffect(() => {
    const path = road.current;
    if (!path) return;
    const total = path.getTotalLength();
    const step = total / (n - 1);
    line.current?.setAttribute("stroke-dasharray", String(total));

    const release = () => {
      chosen.current = null;
    };
    const opts = { passive: true } as const;
    window.addEventListener("wheel", release, opts);
    window.addEventListener("touchstart", release, opts);
    window.addEventListener("keydown", release);

    let last = "";
    let lastCurrent = -1;
    let lastProgress = -1;
    let lastHeight = -1;
    let staleSent = false;
    const update = () => {
      // Nothing to do while the page is still: skip the measuring altogether.
      const progress = pageProgress();
      const vh = window.innerHeight;
      if (progress === lastProgress && vh === lastHeight && chosen.current === null && last !== "") return;
      lastProgress = progress;
      lastHeight = vh;
      // Sections from a page that has just been left (removed or hidden): look for the new ones.
      if (!isShown(sections[0].el) || !isShown(sections[sections.length - 1].el)) {
        if (!staleSent) onStale();
        staleSent = true;
        return;
      }
      // The reading line moves from just under the header (top of the page) to the bottom of
      // the screen (end of the page), so the first and last sections are both reached.
      const reading = TOP_CLEAR + (vh - TOP_CLEAR) * progress;
      const tops = sections.map((s) => s.el.getBoundingClientRect().top);
      const key = `${reading.toFixed(1)} ${tops[0].toFixed(1)} ${chosen.current}`;
      if (key === last) return;
      last = key;

      let current = 0;
      tops.forEach((t, i) => {
        if (t <= reading) current = i;
      });
      const next = tops[current + 1];
      let frac = next === undefined ? 0 : Math.min(1, Math.max(0, (reading - tops[current]) / (next - tops[current])));
      if (chosen.current !== null) {
        current = chosen.current;
        frac = 0;
      }
      const at = Math.min(total, current * step + frac * step);

      line.current?.setAttribute("stroke-dashoffset", String(total - at));
      const p = path.getPointAtLength(at);
      marker.current?.setAttribute("transform", `translate(${p.x} ${p.y})`);
      // Stops, name and count change only when a new stop is reached.
      if (current !== lastCurrent) {
        lastCurrent = current;
        dots.current.forEach((dot, i) => dot?.setAttribute("class", i <= current ? "route-dot is-passed" : "route-dot"));
        if (label.current) label.current.textContent = places[current];
        if (count.current) count.current.textContent = `${current + 1}/${n}`;
      }
      if (label.current) {
        const y = Math.min(ROAD_BOTTOM - 46, Math.max(ROAD_TOP + 46, p.y));
        label.current.setAttribute("transform", `translate(46 ${y.toFixed(1)}) rotate(-90)`);
      }
    };
    update();
    gsap.ticker.add(update);
    return () => {
      gsap.ticker.remove(update);
      window.removeEventListener("wheel", release);
      window.removeEventListener("touchstart", release);
      window.removeEventListener("keydown", release);
    };
  }, [sections, places, n, onStale]);

  return (
    <nav aria-label="Sections on this page" className="route-rail-wrap stock pointer-events-none fixed top-1/2 left-1.5 z-20 -translate-y-1/2 rounded-pill py-3 max-lg:hidden">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="scroll-route block">
        <g aria-hidden>
          {/* Machhapuchhre, the fishtail, over the Annapurna line. */}
          <path d="M4 34 L12 28 L18 31 L26 12 L29 19 L32 9 L36 24 L42 29 L48 26" className="route-peak" />
          <path d="M26 12 L29 19 L32 9" className="route-snow" />
          <path ref={road} d={d} className="route-guide" />
          <path ref={line} d={d} className="route-travelled" />
          {/* Phewa Lake, where every route ends up. */}
          <path d="M6 392 C 10 384, 26 382, 34 388 C 42 393, 40 402, 30 404 C 20 406, 4 402, 6 392 Z" className="route-lake" />
        </g>

        {stops.map((s, i) => (
          <a
            key={sections[i].id}
            href={`#${sections[i].id}`}
            aria-label={`${sections[i].title} (${s.place})`}
            className="route-stop pointer-events-auto"
            onClick={() => {
              chosen.current = i;
            }}
          >
            <title>{`${s.place}: ${sections[i].title}`}</title>
            <circle cx={s.x} cy={s.y} r="11" className="route-hit" />
            <circle
              ref={(el) => {
                dots.current[i] = el;
              }}
              cx={s.x}
              cy={s.y}
              r={i === 0 || i === n - 1 ? 5 : 4}
              className="route-dot"
            />
          </a>
        ))}

        <g aria-hidden>
          <g ref={marker} className="route-marker" transform={`translate(${stops[0].x} ${stops[0].y})`}>
            <circle r="10" className="route-marker-ring" />
            <circle r="5" className="route-marker-dot" />
          </g>
          <text ref={label} textAnchor="middle" className="route-rail-label" transform={`translate(46 ${ROAD_TOP + 46}) rotate(-90)`}>
            {places[0]}
          </text>
          <text ref={count} x={W / 2} y={H - 2} textAnchor="middle" className="route-count">
            1/{n}
          </text>
        </g>
      </svg>
    </nav>
  );
}
