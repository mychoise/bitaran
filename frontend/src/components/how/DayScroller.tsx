"use client";

// "A day with Bitaran": the salesman's phone stays in place beside the four parts of the day,
// and its screen follows the part being read. The four points along the top of the phone are the
// same four parts; the one in view is marked.
//
// The phone is held in place with a ScrollTrigger pin (CSS sticky has no effect inside the smooth
// scroller), from when it reaches the top until the last part has been read. Wide screens only;
// on phones it sits above the parts.

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { PhoneScreen, ScreenBar } from "@/components/product/PhoneScreen";
import { CheckIcon } from "@/components/ui/icons";

export type DayPart = { time: string; short: string; title: string; line: string; example: string };

/** Where the phone stays, below the header. */
const PIN_TOP = 112;

export function DayScroller({ parts }: { parts: DayPart[] }) {
  const [active, setActive] = useState(0);
  const column = useRef<HTMLDivElement>(null);
  const phone = useRef<HTMLDivElement>(null);
  const items = useRef<(HTMLLIElement | null)[]>([]);

  // The part being read: the last one whose top has passed just below the middle of the screen.
  useEffect(() => {
    let last = -1;
    let lastTop = Number.NaN;
    const check = () => {
      // Measure only when the list has moved.
      const top = items.current[0]?.getBoundingClientRect().top ?? 0;
      if (top === lastTop) return;
      lastTop = top;
      const middle = window.innerHeight * 0.55;
      let current = 0;
      items.current.forEach((el, i) => {
        if (el && el.getBoundingClientRect().top <= middle) current = i;
      });
      if (current !== last) {
        last = current;
        setActive(current);
      }
    };
    check();
    gsap.ticker.add(check);
    return () => gsap.ticker.remove(check);
  }, []);

  // Pin the phone from when it reaches the top until its column ends.
  useEffect(() => {
    let pin: ScrollTrigger | null = null;
    const mm = gsap.matchMedia();
    // The smoother (when it is on) is created by the layout just after this mounts, so wait a
    // frame: the pin must know whether it is inside it.
    const frame = requestAnimationFrame(() => {
      if (!phone.current || !column.current) return;
      gsap.registerPlugin(ScrollTrigger);
      mm.add("(min-width: 64rem)", () => {
        pin = ScrollTrigger.create({
          trigger: phone.current,
          start: `top ${PIN_TOP}px`,
          endTrigger: column.current,
          end: () => `bottom ${PIN_TOP + (phone.current?.offsetHeight ?? 0)}px`,
          pin: true,
          pinSpacing: false,
        });
        return () => pin?.kill();
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      mm.revert();
    };
  }, []);

  return (
    <div className="mt-16 grid grid-cols-1 gap-x-columns gap-y-12 lg:grid-cols-12">
      <div ref={column} className="lg:col-span-4">
        <div ref={phone}>
          <figure data-kind="product" className="m-0">
            <DayPhone parts={parts} active={active} />
            <figcaption className="mt-4 text-sm text-muted">Sample data. The screen follows the part of the day you are reading.</figcaption>
          </figure>
        </div>
      </div>
      <ol className="m-0 list-none p-0 lg:col-span-7 lg:col-start-6">
        {parts.map((d, i) => (
          <li
            key={d.time}
            ref={(el) => {
              items.current[i] = el;
            }}
            data-reveal
            aria-current={i === active ? "step" : undefined}
            className="day-part draw-rule pt-6 pb-24 last:pb-0 lg:pb-48 lg:last:pb-80"
          >
            <p className="text-lg font-medium text-muted">{d.time}</p>
            <h3 className="mt-2 text-section">{d.title}</h3>
            <p className="mt-4 text-lg text-ink-2">{d.line}</p>
            <p className="stock mt-6 rounded-stock px-5 py-4 text-md">
              <span className="font-semibold">Example: </span>
              {d.example}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}

function DayPhone({ parts, active }: { parts: DayPart[]; active: number }) {
  return (
    <PhoneScreen className="mx-auto lg:mx-0">
      <ScreenBar title="Example Salesman" aside="Bagar to Lamachaur" />
      {/* The four parts of the day, as points along a line. */}
      <ol className="day-points m-0 flex list-none items-start justify-between border-b border-rule px-4 pt-3 pb-2.5" aria-label="Parts of the day">
        {parts.map((p, i) => (
          <li key={p.short} className="day-point flex flex-1 flex-col items-center gap-1" data-state={i < active ? "done" : i === active ? "now" : "next"}>
            <span className="day-point-dot" aria-hidden />
            <span className="text-xs">{p.short}</span>
          </li>
        ))}
      </ol>
      <div key={active} className="day-screen flex flex-1 flex-col">
        {SCREENS[active]}
      </div>
    </PhoneScreen>
  );
}

function Row({ left, sub, right, done }: { left: string; sub?: string; right: ReactNode; done?: boolean }) {
  return (
    <li className="flex items-center gap-2.5 border-t border-rule px-4 py-2">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{left}</span>
        {sub ? <span className="block truncate text-xs text-muted">{sub}</span> : null}
      </span>
      <span className="shrink-0 font-outlier text-xs">{right}</span>
      {done === undefined ? null : done ? (
        <span className="flex size-5 shrink-0 items-center justify-center rounded-pill bg-ink text-cotton">
          <CheckIcon className="size-3.5" />
          <span className="sr-only">Done</span>
        </span>
      ) : (
        <span className="size-5 shrink-0 rounded-pill border border-ink" />
      )}
    </li>
  );
}

function Heading({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="px-4 pt-3 pb-3">
      <p className="text-lg leading-tight font-semibold">{title}</p>
      <p className="mt-1 text-xs text-muted">{sub}</p>
    </div>
  );
}

function Action({ children }: { children: ReactNode }) {
  return (
    <div className="mt-auto border-t border-rule p-3">
      <span className="flex h-10 items-center justify-center rounded-input bg-ink text-sm font-medium text-cotton">{children}</span>
    </div>
  );
}

/** One screen for each part of the day, matching the examples beside the phone. */
const SCREENS: ReactNode[] = [
  <>
    <Heading title="Today's stock" sub="Issued by the manager this morning" />
    <ol className="m-0 list-none p-0">
      <Row left="Noodles" sub="Carton of 30" right="20 ctn" />
      <Row left="Mustard oil" sub="1 litre bottle" right="48" />
      <Row left="Sugar" sub="25 kg sack" right="6" />
      <Row left="Biscuits" sub="Carton" right="15 ctn" />
    </ol>
    <Action>Start the day</Action>
  </>,
  <>
    <Heading title="Example Kirana, Bagar" sub="Shop 1 of 6 on the route" />
    <ol className="m-0 list-none p-0">
      <Row left="Noodles" sub="3 cartons" right="6,600" />
      <Row left="Paid" sub="Cash" right="6,600" done />
      <Row left="Visit photo" sub="Taken at the counter" right="" done />
    </ol>
    <Action>Next: Example Mart</Action>
  </>,
  <>
    <Heading title="Close the day" sub="Count what comes back" />
    <ol className="m-0 list-none p-0">
      <Row left="Mustard oil" sub="Issued 48, sold 36" right="11 back" />
      <Row left="Short" sub="Shown to the manager tonight" right="1" />
      <Row left="Shops visited" sub="Bagar to Lamachaur" right="6 of 6" />
    </ol>
    <Action>Close my day</Action>
  </>,
  <>
    <Heading title="Example Kirana" sub="Balance, updated tonight" />
    <ol className="m-0 list-none p-0">
      <Row left="Owes" sub="Due on 20 Kartik" right="12,400" />
      <Row left="Today's sale" sub="3 cartons of noodles" right="6,600" />
      <Row left="Paid today" sub="Cash, confirmed" right="6,600" />
    </ol>
    <Action>See all balances</Action>
  </>,
];
