"use client";

// Business settings, owner only: contact details, registration number and logo. The PAN is
// shown but never edited here.

import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { Card, PageHeader } from "@/components/ui/Display";
import { Input } from "@/components/ui/Field";
import { FormProblem } from "@/components/ui/Form";
import { ImagePicker, type ImageChange } from "@/components/ui/ImagePicker";
import { useToast } from "@/components/ui/Overlay";
import { ErrorState, LoadingState } from "@/components/ui/States";
import type { BusinessInput } from "@/lib/api/client";
import { errorMessage, useApiMutation, useApiQuery } from "@/lib/api/provider";
import { businessSchema } from "@/lib/api/schemas";
import type { Business } from "@/lib/api/types";
import { zodResolver } from "@/lib/forms";

type Fields = Omit<BusinessInput, "logoImageId">;

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
  const [logo, setLogo] = useState<ImageChange>({ kind: "keep" });
  const { register, handleSubmit, reset, formState } = useForm<Fields>({ resolver: zodResolver(businessSchema), values: toFields(business) });
  const save = useApiMutation(async (api, input: { fields: Fields; logo: ImageChange }) => {
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
          <ImagePicker title="Logo" alt="Business logo" current={business.logoUrl} change={logo} onChange={setLogo} hint="PNG, JPEG or WebP, under 5 MB. Square works best." emptyText="No logo yet" />
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
