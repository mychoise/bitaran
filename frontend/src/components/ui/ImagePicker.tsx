"use client";

// Picks an image for a record (business logo, product photo), shrinks it in the browser, and
// shows it before it is saved. The parent decides when the change is uploaded.

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ImageProblem, prepareImage } from "@/lib/images";
import { Button } from "./Button";
import { Card } from "./Display";

/** What will happen to the image on save. */
export type ImageChange = { kind: "keep" } | { kind: "remove" } | { kind: "new"; blob: Blob; preview: string };

export function ImagePicker({
  title,
  alt,
  current,
  change,
  onChange,
  hint,
  emptyText,
  maxPx = 512,
  pendingText = "saved when you save settings",
  footer,
}: {
  title: string;
  alt: string;
  /** The saved image's address, if there is one. */
  current?: string;
  change: ImageChange;
  onChange: (c: ImageChange) => void;
  hint: string;
  emptyText: string;
  maxPx?: number;
  /** When a picked change takes effect, e.g. "saved when you save settings". */
  pendingText?: string;
  footer?: ReactNode;
}) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const shown = change.kind === "new" ? change.preview : change.kind === "remove" ? undefined : current;

  // Free the preview's memory when it is replaced or the page closes.
  useEffect(() => () => {
    if (change.kind === "new") URL.revokeObjectURL(change.preview);
  }, [change]);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setProblem(null);
    setBusy(true);
    try {
      const blob = await prepareImage(file, maxPx);
      onChange({ kind: "new", blob, preview: URL.createObjectURL(blob) });
    } catch (e) {
      setProblem(e instanceof ImageProblem ? e.message : "This image could not be read. Try another file.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <Card as="section" dense>
      <h2 className="text-title tracking-normal">{title}</h2>
      <div className="mt-4 flex aspect-square w-40 items-center justify-center rounded-input border border-rule-2 bg-paper">
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element -- an uploaded image (data, blob or backend URL), not a static asset
          <img src={shown} alt={alt} className="size-full rounded-input object-contain" />
        ) : (
          <span className="px-4 text-center text-sm text-muted">{emptyText}</span>
        )}
      </div>
      <p className="mt-3 text-sm text-ink-2">{change.kind === "new" ? `New image, ${pendingText}.` : change.kind === "remove" ? `Image removed, ${pendingText}.` : hint}</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <input ref={input} id={inputId} type="file" accept="image/png,image/jpeg,image/webp" className="visually-hidden" tabIndex={-1} aria-hidden onChange={(e) => pick(e.target.files?.[0])} />
        <Button variant="secondary" size="sm" loading={busy} loadingLabel="Reading…" onClick={() => input.current?.click()}>
          {shown ? "Choose another" : "Choose an image"}
        </Button>
        {shown ? (
          <Button variant="quiet" size="sm" onClick={() => onChange(change.kind === "new" ? { kind: "keep" } : { kind: "remove" })}>
            {change.kind === "new" && current ? "Keep the old one" : "Remove"}
          </Button>
        ) : null}
      </div>
      <p role="alert" className={problem ? "mt-3 text-sm font-medium text-error" : "visually-hidden"}>
        {problem}
      </p>
      {footer}
    </Card>
  );
}
