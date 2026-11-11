"use client";

// Takes a photo with the device's live camera (the back one on a phone). The picture can carry
// the Nepal date and time burned into its corner, as proof of when it was taken. If the camera
// is not available, it says why; a file picker appears only in development, labelled as such.

import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { formatDateTime } from "@/lib/dates";
import { Button } from "./Button";
import { CameraIcon } from "./icons";

export type Shot = { blob: Blob; preview: string; takenAt: string };

const MAX_PX = 1024;
const isDev = process.env.NODE_ENV !== "production";

/** Draws the source into a canvas no larger than MAX_PX, with the time stamp if asked. */
async function toShot(source: CanvasImageSource, width: number, height: number, stamp: boolean, nepalTimeLabel: (time: string) => string): Promise<Shot> {
  const scale = Math.min(1, MAX_PX / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  const takenAt = new Date().toISOString();
  if (stamp) {
    const css = getComputedStyle(document.documentElement);
    const text = nepalTimeLabel(formatDateTime(takenAt));
    const size = Math.max(14, Math.round(canvas.width / 32));
    ctx.font = `600 ${size}px ${css.getPropertyValue("--font-outlier") || "monospace"}`;
    const pad = Math.round(size / 2);
    const w = ctx.measureText(text).width + pad * 2;
    ctx.fillStyle = css.getPropertyValue("--color-board").trim() || "black";
    ctx.globalAlpha = 0.8;
    ctx.fillRect(pad, canvas.height - size - pad * 3, w, size + pad * 2);
    ctx.globalAlpha = 1;
    ctx.fillStyle = css.getPropertyValue("--color-board-type").trim() || "white";
    ctx.fillText(text, pad * 2, canvas.height - pad * 2 - size * 0.15);
  }
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob) throw new Error("The photo could not be made.");
  return { blob, preview: URL.createObjectURL(blob), takenAt };
}

export function Camera({ label, stamp = false, shot, onShot }: { label: string; stamp?: boolean; shot: Shot | null; onShot: (s: Shot | null) => void }) {
  const t = useTranslations("Ui.Camera");
  const nepalTimeLabel = (time: string) => t("nepalTime", { time });
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const fileId = useId();
  const [state, setState] = useState<"idle" | "starting" | "live" | "error">("idle");
  const [problem, setProblem] = useState<string | null>(null);

  const stop = () => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  };
  useEffect(() => stop, []);
  useEffect(() => () => {
    if (shot) URL.revokeObjectURL(shot.preview);
  }, [shot]);

  const start = async () => {
    setProblem(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setState("error");
      setProblem(t("noMediaApi"));
      return;
    }
    setState("starting");
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      if (video.current) {
        video.current.srcObject = stream.current;
        await video.current.play();
      }
      setState("live");
    } catch (e) {
      setState("error");
      const name = e instanceof DOMException ? e.name : "";
      setProblem(name === "NotAllowedError" ? t("permissionDenied") : name === "NotFoundError" ? t("notFound") : t("startFailed"));
    }
  };

  const capture = async () => {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    try {
      onShot(await toShot(v, v.videoWidth, v.videoHeight, stamp, nepalTimeLabel));
      stop();
      setState("idle");
    } catch {
      setProblem(t("captureFailed"));
    }
  };

  const fromFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const bitmap = await createImageBitmap(file);
      onShot(await toShot(bitmap, bitmap.width, bitmap.height, stamp, nepalTimeLabel));
      bitmap.close();
    } catch {
      setProblem(t("fileReadFailed"));
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="font-medium">{label}</p>
      {shot ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- a photo just taken, held in memory */}
          <img src={shot.preview} alt={t("takenAlt", { label, time: formatDateTime(shot.takenAt) })} className="max-h-96 w-full rounded-input border border-rule-2 bg-paper-3 object-contain" />
          <Button variant="secondary" onClick={() => onShot(null)}>
            {t("retake")}
          </Button>
        </>
      ) : (
        <>
          <div className={state === "live" || state === "starting" ? "relative overflow-hidden rounded-input border border-rule-2 bg-board" : "hidden"}>
            <video ref={video} playsInline muted className="block max-h-96 w-full object-contain" aria-label={t("videoAria")} />
            {stamp && state === "live" ? (
              <span className="absolute bottom-2 left-2 rounded-input bg-board px-2 py-1 font-outlier text-xs text-board-type" aria-hidden>
                {nepalTimeLabel(formatDateTime(new Date()))}
              </span>
            ) : null}
          </div>
          {state === "live" ? (
            <Button size="lg" icon={<CameraIcon className="size-6" />} onClick={capture}>
              {t("takePhoto")}
            </Button>
          ) : (
            <Button variant="secondary" size="lg" icon={<CameraIcon className="size-6" />} loading={state === "starting"} loadingLabel={t("opening")} onClick={start}>
              {t("openCamera")}
            </Button>
          )}
        </>
      )}
      <p role={problem ? "alert" : undefined} className={problem ? "text-sm font-medium text-error" : "visually-hidden"}>
        {problem}
      </p>
      {isDev && !shot ? (
        <div className="rounded-input border border-dashed border-muted p-3 text-sm">
          <label htmlFor={fileId} className="font-medium">
            {t("devPickFile")}
          </label>
          <input id={fileId} type="file" accept="image/png,image/jpeg,image/webp" className="mt-2 block w-full text-sm" onChange={(e) => fromFile(e.target.files?.[0])} />
          <p className="mt-1 text-muted">{t("devNote")}</p>
        </div>
      ) : null}
    </div>
  );
}
