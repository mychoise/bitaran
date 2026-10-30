"use client";

// Business settings, owner only: contact details, registration number and logo. The PAN is
// shown but never edited here.

import { useEffect, useId, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { Card, PageHeader } from "@/components/ui/Display";
import { Input } from "@/components/ui/Field";
import { FormProblem } from "@/components/ui/Form";
import { useToast } from "@/components/ui/Overlay";
import { ErrorState, LoadingState } from "@/components/ui/States";
import type { BusinessInput } from "@/lib/api/client";
import { errorMessage, useApiMutation, useApiQuery } from "@/lib/api/provider";
import { businessSchema } from "@/lib/api/schemas";
import type { Business } from "@/lib/api/types";
import { zodResolver } from "@/lib/forms";
import { ImageProblem, prepareImage } from "@/lib/images";

type Fields = Omit<BusinessInput, "logoImageId">;
/** What will happen to the logo on save. */
type LogoChange = { kind: "keep" } | { kind: "remove" } | { kind: "new"; blob: Blob; preview: string };

const toFields = (b: Business): Fields => ({ name: b.name, phone: b.phone, email: b.email, address: b.address, city: b.city, registrationNo: b.registrationNo });

export function BusinessSettings() {
  const q = useApiQuery(["business"], (api) => api.business.get());
  if (q.isPending) return <LoadingState label="Loading settings" />;
  if (q.isError) return <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  return <SettingsForm business={q.data} />;
}

function SettingsForm({ business }: { business: Business }) {
  const toast = useToast();
  const [problem, setProblem] = useState<string | null>(null);
  const [logo, setLogo] = useState<LogoChange>({ kind: "keep" });
  const { register, handleSubmit, reset, formState } = useForm<Fields>({ resolver: zodResolver(businessSchema), values: toFields(business) });
  const save = useApiMutation(async (api, input: { fields: Fields; logo: LogoChange }) => {
    let logoImageId: string | null | undefined;
    if (input.logo.kind === "new") logoImageId = (await api.uploads.image(input.logo.blob)).id;
    if (input.logo.kind === "remove") logoImageId = null;
    return api.business.update({ ...input.fields, logoImageId });
  }, [["business"]]);
  const err = formState.errors;
  const dirty = formState.isDirty || logo.kind !== "keep";

  const onSubmit = handleSubmit(async (fields) => {
    setProblem(null);
    try {
      const saved = await save.mutateAsync({ fields, logo });
      reset(toFields(saved));
      setLogo({ kind: "keep" });
      toast("Settings saved.");
    } catch (e) {
      setProblem(errorMessage(e));
    }
  });

  const undo = () => {
    reset();
    setLogo({ kind: "keep" });
    setProblem(null);
  };

  return (
    <>
      <PageHeader title="Settings" lead="Your business details, as shown on invoices and to your shops." />
      <form onSubmit={onSubmit} noValidate>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
          <Card as="section" className="lg:col-span-2">
            <h2 className="text-title tracking-normal">Business details</h2>
            <div className="mt-5 grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-2">
              <div className="md:col-span-2">
                <Input label="Business name" autoComplete="organization" error={err.name?.message} {...register("name")} />
              </div>
              <Input label="Phone" type="tel" inputMode="tel" autoComplete="tel" error={err.phone?.message} {...register("phone")} />
              <Input label="Email" type="email" inputMode="email" autoComplete="email" error={err.email?.message} {...register("email")} />
              <div className="md:col-span-2">
                <Input label="Address" autoComplete="street-address" hint="Street, tole or ward." error={err.address?.message} {...register("address")} />
              </div>
              <Input label="City" autoComplete="address-level2" error={err.city?.message} {...register("city")} />
              <Input label="Registration number" hint="Optional. Your company registration number." error={err.registrationNo?.message} {...register("registrationNo")} />
            </div>
            <div className="mt-2 border-t border-rule-2 pt-5">
              <p className="text-sm text-muted">PAN</p>
              <p className="mt-1 font-outlier text-lg">{business.pan}</p>
              <p className="mt-1 text-sm text-ink-2">Set when the business signed up. It cannot be changed here.</p>
            </div>
          </Card>
          <LogoPicker current={business.logoUrl} change={logo} onChange={setLogo} />
        </div>
        <FormProblem message={problem} />
        <div className="mt-6 flex flex-wrap gap-3">
          <Button type="submit" loading={save.isPending} loadingLabel="Saving…" disabled={!dirty}>
            Save settings
          </Button>
          {dirty ? (
            <Button variant="quiet" onClick={undo}>
              Undo changes
            </Button>
          ) : null}
        </div>
      </form>
    </>
  );
}

function LogoPicker({ current, change, onChange }: { current?: string; change: LogoChange; onChange: (c: LogoChange) => void }) {
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
      const blob = await prepareImage(file, 512);
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
      <h2 className="text-title tracking-normal">Logo</h2>
      <div className="mt-4 flex aspect-square w-40 items-center justify-center rounded-input border border-rule-2 bg-paper">
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element -- an uploaded image (data, blob or backend URL), not a static asset
          <img src={shown} alt="Business logo" className="size-full rounded-input object-contain" />
        ) : (
          <span className="px-4 text-center text-sm text-muted">No logo yet</span>
        )}
      </div>
      <p className="mt-3 text-sm text-ink-2">{change.kind === "new" ? "New logo, saved when you save settings." : change.kind === "remove" ? "The logo is removed when you save settings." : "PNG, JPEG or WebP, under 5 MB. Square works best."}</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <input ref={input} id={inputId} type="file" accept="image/png,image/jpeg,image/webp" className="visually-hidden" tabIndex={-1} aria-hidden onChange={(e) => pick(e.target.files?.[0])} />
        <Button variant="secondary" size="sm" loading={busy} loadingLabel="Reading…" onClick={() => input.current?.click()}>
          {shown ? "Choose another" : "Choose a logo"}
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
    </Card>
  );
}
