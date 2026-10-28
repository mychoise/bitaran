import type { ReactNode } from "react";

type Props = {
  /** Slot name, so a real screenshot can replace this built sample later. */
  slot: string;
  /** What the real screenshot for this slot should show. */
  screenshot: string;
  children: ReactNode;
  caption?: string;
  className?: string;
};

/**
 * Wraps a built product sample. Everything inside is sample data, and the caption says so.
 * To swap in a real screenshot, replace `children` with a next/image <Image>.
 */
export function ProductFigure({ slot, screenshot, children, caption, className = "" }: Props) {
  return (
    <figure
      data-slot={slot}
      data-kind="product"
      data-alt={screenshot}
      className={`m-0 overflow-visible bg-transparent bg-none ${className}`.trim()}
    >
      {children}
      <figcaption className="mt-4 text-sm text-muted">
        Sample data{caption ? `. ${caption}` : ""}
      </figcaption>
    </figure>
  );
}
