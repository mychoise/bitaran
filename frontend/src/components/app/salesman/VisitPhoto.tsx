"use client";

// A visit photo: taken with the live camera, with the Nepal date and time burned into it, and an
// optional note. The upload says plainly whether it worked. If the photo is flagged (old, far
// from the shop, or the same as an earlier one) it is still saved; the manager looks at it.

import Link from "next/link";
import { useState } from "react";
import { Button, buttonClass } from "@/components/ui/Button";
import { Camera, type Shot } from "@/components/ui/Camera";
import { Card } from "@/components/ui/Display";
import { Checkbox, Textarea } from "@/components/ui/Field";
import { FormProblem } from "@/components/ui/Form";
import { errorMessage, useApiMutation } from "@/lib/api/provider";
import type { VisitPhoto as Photo, VisitShop } from "@/lib/api/types";
import { PHOTO_FLAG } from "../labels";
import { formatDateTime } from "@/lib/dates";
import { useOnceKey, useSingleFlight, VisitGate } from "./onVisit";
import { DAY_AFFECTS } from "./useToday";


/** The phone's location, if the salesman allows it. Never required. */
function where(): Promise<{ latitude: number; longitude: number } | null> {
  if (!("geolocation" in navigator)) return Promise.resolve(null);
  return new Promise((resolve) =>
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    ),
  );
}

export function VisitPhoto() {
  return <VisitGate title="Visit photo">{(v) => <PhotoForm v={v} />}</VisitGate>;
}

function PhotoForm({ v }: { v: VisitShop }) {
  const { key, renew } = useOnceKey();
  const single = useSingleFlight();
  const [shot, setShot] = useState<Shot | null>(null);
  const [note, setNote] = useState("");
  const [useLocation, setUseLocation] = useState(true);
  const [state, setState] = useState<"ready" | "sending" | "failed" | "saved">("ready");
  const [problem, setProblem] = useState<string | null>(null);
  const [saved, setSaved] = useState<Photo | null>(null);
  const send = useApiMutation(async (api, input: { shot: Shot; note: string; at: { latitude: number; longitude: number } | null }) => {
    const { id } = await api.uploads.image(input.shot.blob);
    return api.photos.create({ idempotencyKey: key, visitId: v.visit.id, imageId: id, note: input.note, deviceTakenAt: input.shot.takenAt, ...(input.at ?? {}) });
  }, [...DAY_AFFECTS, ["photos"]]);

  const submit = () => single(async () => {
    if (!shot) return;
    setProblem(null);
    setState("sending");
    try {
      const at = useLocation ? await where() : null;
      const photo = await send.mutateAsync({ shot, note, at });
      renew();
      setSaved(photo);
      setState("saved");
    } catch (e) {
      setState("failed");
      setProblem(`Not saved: ${errorMessage(e)} Your photo is still here; try again.`);
    }
  });

  if (state === "saved" && saved)
    return (
      <Card as="section" aria-label="Photo saved">
        <p className="text-lg font-medium">Photo saved, {formatDateTime(saved.takenAt)}.</p>
        <p className="mt-1 text-ink-2">{v.shop.name} is marked visited.</p>
        {saved.flags.length ? (
          <div className="mt-4 rounded-input border border-rule-2 bg-paper-3 p-4">
            <p className="font-medium">The manager will review this photo.</p>
            <ul className="m-0 mt-2 list-disc pl-5 text-ink-2">
              {saved.flags.map((f) => (
                <li key={f}>{PHOTO_FLAG[f].line}</li>
              ))}
            </ul>
            <p className="mt-2 text-sm text-muted">This is a note for review, not a mistake. The photo is saved.</p>
          </div>
        ) : null}
        <Link href={`/app/salesman/shops/${v.visit.id}`} className={buttonClass("primary", "lg", "mt-6 w-full")}>
          Back to {v.shop.name}
        </Link>
      </Card>
    );

  return (
    <div className="flex flex-col gap-6">
      <Card as="section" dense aria-label="Photo">
        <Camera label="Photo of the shop" stamp shot={shot} onShot={setShot} />
        <p className="mt-3 text-sm text-ink-2">The Nepal date and time are printed on the photo.</p>
      </Card>
      <Card as="section" dense aria-label="Note and location">
        <Textarea label="Note" hint="Optional, like who you met." value={note} error={note.length > 300 ? "Keep the note under 300 characters." : undefined} onChange={(e) => setNote(e.target.value)} />
        <Checkbox label="Add this phone's location" hint="Helps your manager see the photo was taken at the shop. Your browser may ask first." checked={useLocation} onChange={(e) => setUseLocation(e.target.checked)} />
      </Card>
      <p className="text-sm text-ink-2" aria-live="polite">
        {state === "sending" ? "Uploading the photo…" : state === "failed" ? "The photo was not saved yet." : shot ? "Ready to upload." : "Take the photo first."}
      </p>
      <FormProblem message={problem} />
      <Button size="lg" className="w-full" disabled={!shot || note.length > 300} loading={state === "sending"} loadingLabel="Uploading…" onClick={submit}>
        {state === "failed" ? "Try again" : "Save photo"}
      </Button>
    </div>
  );
}
