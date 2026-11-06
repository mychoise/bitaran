"use client";

// A new shop, added by the salesman. Its opening balance starts at zero (the
// manager sets them), and it needs a login. If the day is in progress it joins today's shops.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Display";
import { Checkbox, Input } from "@/components/ui/Field";
import { BackLink, FormProblem } from "@/components/ui/Form";
import { useToast } from "@/components/ui/Overlay";
import { ApiError } from "@/lib/api/client";
import { checkPan } from "@/lib/api/mock/rules";
import { errorMessage, useApiMutation } from "@/lib/api/provider";
import { emailField, phoneField, requiredText, temporaryPasswordField } from "@/lib/api/schemas";
import { zodResolver } from "@/lib/forms";
import { DAY_AFFECTS, useToday } from "./useToday";

const schema = z
  .object({
    name: requiredText("shop name", 120),
    ownerName: requiredText("owner's name", 100),
    phone: phoneField,
    address: requiredText("address", 200),
    pan: z.string().trim(),
    loginEmail: emailField,
    temporaryPassword: temporaryPasswordField,
  })
  .superRefine((v, ctx) => {
    const pan = checkPan(v.pan);
    if (pan) ctx.addIssue({ code: "custom", path: ["pan"], message: pan });
  });
type Values = z.infer<typeof schema>;

export function NewShop() {
  const router = useRouter();
  const toast = useToast();
  const { plan } = useToday();
  const [show, setShow] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const { register, handleSubmit, setError, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", ownerName: "", phone: "", address: "", pan: "", loginEmail: "", temporaryPassword: "" },
  });
  const create = useApiMutation(async (api, v: Values) => {
    const shop = await api.shops.create({
      ...v,
      routeId: null,
      registrationNo: "",
      latitude: null,
      longitude: null,
      creditLimitPaisa: 0,
      openingBalancePaisa: 0,
      dueDays: 7,
    });
    const live = plan.data?.status === "in_progress" ? plan.data : null;
    const visit = live ? await api.dayPlans.addVisit(live.id, shop.id) : null;
    return { shop, visit };
  }, DAY_AFFECTS);
  const err = formState.errors;

  const onSubmit = handleSubmit(async (v) => {
    setProblem(null);
    try {
      const { shop, visit } = await create.mutateAsync(v);
      toast(visit ? `${shop.name} added, and on today's shops. Give the shop its password in person.` : `${shop.name} added. Give the shop its password in person.`);
      router.push(visit ? `/app/salesman/shops/${visit.visit.id}` : "/app/salesman/shops");
    } catch (e) {
      if (e instanceof ApiError && e.code === "conflict" && e.message.includes("PAN")) setError("pan", { message: e.message }, { shouldFocus: true });
      else if (e instanceof ApiError && e.code === "conflict" && e.message.includes("email")) setError("loginEmail", { message: e.message }, { shouldFocus: true });
      else setProblem(errorMessage(e));
    }
  });

  return (
    <div className="mx-auto max-w-3xl">
      <BackLink href="/app/salesman/shops" label="Shops" />
      <h1 className="text-display-s">New shop</h1>
      <p className="mt-2 text-lg text-ink-2">It starts with no opening balance. Your manager sets those, and puts it on a route.</p>
      <form onSubmit={onSubmit} noValidate className="mt-6 flex flex-col gap-6">
        <Card as="section" dense aria-label="The shop">
          <Input label="Shop name" autoComplete="off" error={err.name?.message} {...register("name")} />
          <Input label="Owner's name" autoComplete="off" error={err.ownerName?.message} {...register("ownerName")} />
          <Input label="Phone" type="tel" inputMode="tel" autoComplete="off" error={err.phone?.message} {...register("phone")} />
          <Input label="Address" autoComplete="off" hint="Tole, ward and city." error={err.address?.message} {...register("address")} />
          <Input label="PAN" inputMode="numeric" autoComplete="off" hint="Optional. 9 digits." error={err.pan?.message} {...register("pan")} />
        </Card>
        <Card as="section" dense aria-labelledby="login-title">
          <h2 id="login-title" className="text-title tracking-normal">
            The shop&apos;s login
          </h2>
          <p className="mt-1 mb-4 text-sm text-ink-2">Required. With it the shop sees its own balance and statement.</p>
          <Input label="Login email" type="email" inputMode="email" autoComplete="off" hint="Unique for each shop." error={err.loginEmail?.message} {...register("loginEmail")} />
          <Input label="Temporary password" type={show ? "text" : "password"} autoComplete="new-password" hint="At least 8 characters. Give it to the shop in person." error={err.temporaryPassword?.message} {...register("temporaryPassword")} />
          <Checkbox label="Show password" checked={show} onChange={(e) => setShow(e.target.checked)} />
        </Card>
        <FormProblem message={problem} />
        <Button type="submit" size="lg" className="w-full" loading={formState.isSubmitting} loadingLabel="Adding…">
          Add shop
        </Button>
      </form>
    </div>
  );
}
