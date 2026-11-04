"use client";

// The shop form, for adding a shop and for its Details tab. Money is typed in rupees and kept
// as paisa; the location is two numbers, no map. A login (email and temporary password) can be
// given when the shop is added or later.

import { useState, type ReactNode } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Display";
import { Checkbox, Input, Select } from "@/components/ui/Field";
import { FormProblem } from "@/components/ui/Form";
import { ImagePicker, type ImageChange } from "@/components/ui/ImagePicker";
import { ApiError, type ShopCreateInput } from "@/lib/api/client";
import { checkLocation, checkPan } from "@/lib/api/mock/rules";
import { errorMessage, useApiQuery } from "@/lib/api/provider";
import { emailField, phoneField, requiredText, temporaryPasswordField } from "@/lib/api/schemas";
import type { ShopWithBalance } from "@/lib/api/types";
import { WHOLE, zodResolver } from "@/lib/forms";
import { formatAmount, parseRupees, parseSignedRupees } from "@/lib/money";

export type ShopFormValues = {
  name: string;
  ownerName: string;
  phone: string;
  address: string;
  routeId: string;
  dueDays: string;
  pan: string;
  registrationNo: string;
  latitude: string;
  longitude: string;
  creditLimit: string;
  openingBalance: string;
  giveLogin: boolean;
  loginEmail: string;
  temporaryPassword: string;
};

const coord = (v: string) => (v.trim() === "" ? null : Number(v.trim()));

/** The checks, on the text as typed. `hasLogin` is whether the shop already has a login. */
function schemaFor(hasLogin: boolean) {
  return z
    .object({
      name: requiredText("shop name", 120),
      ownerName: requiredText("owner's name", 100),
      phone: phoneField,
      address: requiredText("address", 200),
      routeId: z.string(),
      dueDays: z.string().regex(WHOLE, "Enter the days to pay as a whole number, like 7."),
      pan: z.string().trim(),
      registrationNo: z.string().trim().max(50, "Keep the registration number under 50 characters."),
      latitude: z.string(),
      longitude: z.string(),
      creditLimit: z.string().refine((v) => parseRupees(v) !== null, "Enter the credit limit in rupees, like 30,000."),
      openingBalance: z.string().refine((v) => parseSignedRupees(v) !== null, "Enter the opening balance in rupees. Use a minus for credit, like -500."),
      giveLogin: z.boolean(),
      loginEmail: z.string(),
      temporaryPassword: z.string(),
    })
    .superRefine((v, ctx) => {
      const pan = checkPan(v.pan);
      if (pan) ctx.addIssue({ code: "custom", path: ["pan"], message: pan });
      const lat = coord(v.latitude);
      const lng = coord(v.longitude);
      if ((lat !== null && Number.isNaN(lat)) || (lng !== null && Number.isNaN(lng))) ctx.addIssue({ code: "custom", path: ["latitude"], message: "Use numbers with a dot, like 28.2096 and 83.9856." });
      else {
        const at = checkLocation(lat, lng);
        if (at) ctx.addIssue({ code: "custom", path: [lat === null ? "latitude" : at.startsWith("Longitude") ? "longitude" : "latitude"], message: at });
      }
      if (hasLogin || v.giveLogin) {
        const e = emailField.safeParse(v.loginEmail);
        if (!e.success) ctx.addIssue({ code: "custom", path: ["loginEmail"], message: e.error.issues[0].message });
      }
      if (!hasLogin && v.giveLogin) {
        const p = temporaryPasswordField.safeParse(v.temporaryPassword);
        if (!p.success) ctx.addIssue({ code: "custom", path: ["temporaryPassword"], message: p.error.issues[0].message });
      }
    });
}

const EMPTY: ShopFormValues = {
  name: "", ownerName: "", phone: "", address: "", routeId: "", dueDays: "7", pan: "", registrationNo: "",
  latitude: "", longitude: "", creditLimit: "0", openingBalance: "0", giveLogin: false, loginEmail: "", temporaryPassword: "",
};

export const fromShop = (s: ShopWithBalance): ShopFormValues => ({
  name: s.name,
  ownerName: s.ownerName,
  phone: s.phone,
  address: s.address,
  routeId: s.routeId ?? "",
  dueDays: String(s.dueDays),
  pan: s.pan,
  registrationNo: s.registrationNo,
  latitude: s.latitude === null ? "" : String(s.latitude),
  longitude: s.longitude === null ? "" : String(s.longitude),
  creditLimit: formatAmount(s.creditLimitPaisa),
  openingBalance: `${s.openingBalancePaisa < 0 ? "-" : ""}${formatAmount(s.openingBalancePaisa)}`,
  giveLogin: false,
  loginEmail: s.loginEmail ?? "",
  temporaryPassword: "",
});

/** Checked form values as the API's input. The login goes only when it is new or changed. */
export function toShopInput(v: ShopFormValues, shop?: ShopWithBalance): ShopCreateInput {
  const input: ShopCreateInput = {
    name: v.name.trim(),
    ownerName: v.ownerName.trim(),
    phone: v.phone.trim(),
    address: v.address.trim(),
    routeId: v.routeId || null,
    pan: v.pan.trim(),
    registrationNo: v.registrationNo.trim(),
    latitude: coord(v.latitude),
    longitude: coord(v.longitude),
    creditLimitPaisa: parseRupees(v.creditLimit)!,
    openingBalancePaisa: parseSignedRupees(v.openingBalance)!,
    dueDays: Number(v.dueDays),
  };
  if (shop?.hasLogin) {
    if (v.loginEmail.trim().toLowerCase() !== (shop.loginEmail ?? "")) input.loginEmail = v.loginEmail.trim();
  } else if (v.giveLogin) {
    input.loginEmail = v.loginEmail.trim();
    input.temporaryPassword = v.temporaryPassword;
  }
  return input;
}

export function ShopForm({
  mode,
  shop,
  onSave,
  submitLabel,
}: {
  mode: "create" | "edit";
  shop?: ShopWithBalance;
  /** Saves the shop and its PAN card photo change; throws an ApiError to show it on the form. */
  onSave: (input: ShopCreateInput, panPhoto: ImageChange) => Promise<ShopWithBalance | void>;
  submitLabel: string;
}) {
  const routes = useApiQuery(["routes", "list"], (api) => api.routes.list());
  const [problem, setProblem] = useState<string | null>(null);
  const [panPhoto, setPanPhoto] = useState<ImageChange>({ kind: "keep" });
  const [showPassword, setShowPassword] = useState(false);
  const hasLogin = Boolean(shop?.hasLogin);
  const { register, handleSubmit, setError, reset, control, formState } = useForm<ShopFormValues>({
    resolver: zodResolver(schemaFor(hasLogin)),
    values: shop ? fromShop(shop) : undefined,
    defaultValues: shop ? undefined : EMPTY,
  });
  const giveLogin = useWatch({ control, name: "giveLogin" });
  const err = formState.errors;
  const dirty = formState.isDirty || panPhoto.kind !== "keep";

  const onSubmit = handleSubmit(async (values) => {
    setProblem(null);
    try {
      const saved = await onSave(toShopInput(values, shop), panPhoto);
      setPanPhoto({ kind: "keep" });
      if (saved) reset(fromShop(saved));
    } catch (e) {
      if (e instanceof ApiError && e.code === "conflict" && e.message.includes("PAN")) setError("pan", { message: e.message }, { shouldFocus: true });
      else if (e instanceof ApiError && e.code === "conflict" && e.message.includes("email")) setError("loginEmail", { message: e.message }, { shouldFocus: true });
      else setProblem(errorMessage(e));
    }
  });

  const section = (title: string, children: ReactNode, lead?: string) => (
    <Card as="section" dense>
      <h2 className="text-title tracking-normal">{title}</h2>
      {lead ? <p className="mt-1 text-sm text-ink-2">{lead}</p> : null}
      <div className="mt-5 grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-2">{children}</div>
    </Card>
  );

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      {section(
        "Shop",
        <>
          <Input label="Shop name" autoComplete="off" error={err.name?.message} {...register("name")} />
          <Input label="Owner's name" autoComplete="off" error={err.ownerName?.message} {...register("ownerName")} />
          <Input label="Phone" type="tel" inputMode="tel" autoComplete="off" error={err.phone?.message} {...register("phone")} />
          <Select label="Route" disabled={routes.isPending} hint={routes.isError ? "Routes did not load. Reload to try again." : "You can also set the order on the route's page."} {...register("routeId")}>
            <option value="">On no route</option>
            {routes.data?.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
          <div className="md:col-span-2">
            <Input label="Address" autoComplete="off" hint="Tole, ward and city." error={err.address?.message} {...register("address")} />
          </div>
        </>,
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
        <div className="lg:col-span-2">
          {section(
            "Tax and registration",
            <>
              <Input label="PAN" inputMode="numeric" autoComplete="off" hint="Optional. 9 digits, unique for each shop." error={err.pan?.message} {...register("pan")} />
              <Input label="Registration number" autoComplete="off" hint="Optional." error={err.registrationNo?.message} {...register("registrationNo")} />
            </>,
          )}
        </div>
        <ImagePicker
          title="PAN card photo"
          alt={`PAN card of ${shop?.name ?? "this shop"}`}
          current={shop?.panImageUrl}
          change={panPhoto}
          onChange={setPanPhoto}
          hint="Optional. A clear photo of the PAN card."
          emptyText="No photo yet"
          maxPx={1200}
          pendingText={mode === "create" ? "saved with the shop" : "saved when you save"}
        />
      </div>

      {section(
        "Location",
        <>
          <Input label="Latitude" inputMode="decimal" autoComplete="off" placeholder="28.2096" error={err.latitude?.message} {...register("latitude")} />
          <Input label="Longitude" inputMode="decimal" autoComplete="off" placeholder="83.9856" error={err.longitude?.message} {...register("longitude")} />
        </>,
        "Optional. From a maps app: press and hold on the shop, then copy the two numbers. Both, or neither.",
      )}

      {section(
        "Credit",
        <>
          <Input label="Credit limit (Rs)" inputMode="decimal" autoComplete="off" hint="Most the shop can owe. A salesman cannot sell past it." error={err.creditLimit?.message} {...register("creditLimit")} />
          <Input label="Opening balance (Rs)" inputMode="decimal" autoComplete="off" hint="Owed from before. Use a minus for credit, like -500." error={err.openingBalance?.message} {...register("openingBalance")} />
          <Input label="Days to pay" inputMode="numeric" autoComplete="off" hint="Each sale is due this many days later." error={err.dueDays?.message} {...register("dueDays")} />
        </>,
      )}

      <Card as="section" dense>
        <h2 className="text-title tracking-normal">Login</h2>
        {hasLogin ? (
          <>
            <p className="mt-1 text-sm text-ink-2">The shop signs in with this email to see its own balance and statement.</p>
            <div className="mt-5 max-w-md">
              <Input label="Login email" type="email" inputMode="email" autoComplete="off" hint="Unique for each shop." error={err.loginEmail?.message} {...register("loginEmail")} />
            </div>
          </>
        ) : (
          <>
            <p className="mt-1 text-sm text-ink-2">Optional. With a login, the shop sees its own balance, statement, invoices and payments.</p>
            <div className="mt-4">
              <Checkbox label="Give this shop a login" {...register("giveLogin")} />
            </div>
            {giveLogin ? (
              <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-2">
                <Input label="Login email" type="email" inputMode="email" autoComplete="off" hint="Unique for each shop." error={err.loginEmail?.message} {...register("loginEmail")} />
                <div>
                  <Input
                    label="Temporary password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    hint="At least 8 characters. Give it to the shop in person."
                    error={err.temporaryPassword?.message}
                    {...register("temporaryPassword")}
                  />
                  <Checkbox label="Show password" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} />
                </div>
              </div>
            ) : null}
          </>
        )}
      </Card>

      <div>
        <FormProblem message={problem} />
        <div className="mt-2 flex flex-wrap gap-3">
          <Button type="submit" loading={formState.isSubmitting} loadingLabel="Saving…" disabled={mode === "edit" && !dirty}>
            {submitLabel}
          </Button>
          {mode === "edit" && dirty ? (
            <Button
              variant="quiet"
              onClick={() => {
                reset();
                setPanPhoto({ kind: "keep" });
              }}
            >
              Undo changes
            </Button>
          ) : null}
        </div>
      </div>
    </form>
  );
}
