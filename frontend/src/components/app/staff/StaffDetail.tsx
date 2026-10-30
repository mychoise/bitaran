"use client";

// One person: edit their details, activate or deactivate them, set a temporary password.
// Nobody is ever deleted; a deactivated person's records stay as they are.

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { Button, buttonClass } from "@/components/ui/Button";
import { Card, PageHeader, StatusBadge } from "@/components/ui/Display";
import { Checkbox, Input, Select } from "@/components/ui/Field";
import { BackLink, FormProblem } from "@/components/ui/Form";
import { ConfirmDialog, Modal, useToast } from "@/components/ui/Overlay";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { ApiError, type StaffInput } from "@/lib/api/client";
import { canEditStaff, checkPasswordReset, checkStaffChange, rolesCreatableBy } from "@/lib/api/mock/rules";
import { errorMessage, useApi, useApiMutation, useApiQuery } from "@/lib/api/provider";
import { firstIssue, staffSchema, temporaryPasswordField } from "@/lib/api/schemas";
import type { Staff } from "@/lib/api/types";
import { formatDate, formatDateTime } from "@/lib/dates";
import { zodResolver } from "@/lib/forms";
import { ROLE_LABEL } from "../labels";

type Actor = { id: string; role: Staff["role"] };

/** The owner's form has no role field: that role never changes. */
const detailsSchema = staffSchema.partial({ role: true });
type DetailsValues = z.infer<typeof detailsSchema>;

export function StaffDetail({ id }: { id: string }) {
  const { viewer } = useApi();
  const q = useApiQuery(["staff", "detail", id], (api) => api.staff.get(id));
  if (q.isPending) return <LoadingState label="Loading this person" />;
  if (q.isError) {
    if (q.error instanceof ApiError && q.error.code === "not_found")
      return (
        <>
          <BackLink href="/app/manager/staff" label="Staff" />
          <EmptyState title="This person was not found" line="They may have been added in another browser. Go back to the staff list." action={<Link href="/app/manager/staff" className={buttonClass("secondary", "sm")}>Back to staff</Link>} />
        </>
      );
    return <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  }
  const person = q.data;
  const me: Actor = viewer.type === "staff" ? { id: viewer.id, role: viewer.role } : { id: "", role: "salesman" };
  return (
    <>
      <BackLink href="/app/manager/staff" label="Staff" />
      <PageHeader
        title={person.fullName}
        lead={`${ROLE_LABEL[person.role]}, joined ${formatDate(person.joinedOn)}`}
        actions={<StatusBadge status={person.active ? "active" : "inactive"} />}
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
        <div className="lg:col-span-2">{canEditStaff(me, person) ? <DetailsForm person={person} me={me} /> : <DetailsReadOnly person={person} />}</div>
        <div className="flex flex-col gap-6">
          <Access person={person} me={me} />
          <History person={person} />
        </div>
      </div>
    </>
  );
}

// ---- details ---------------------------------------------------------------------------------

function DetailsReadOnly({ person }: { person: Staff }) {
  const rows: [string, string][] = [
    ["Full name", person.fullName],
    ["Role", ROLE_LABEL[person.role]],
    ["Email", person.email],
    ["Phone", person.phone],
  ];
  return (
    <Card as="section">
      <h2 className="text-title tracking-normal">Details</h2>
      <dl className="m-0 mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt className="text-sm text-muted">{k}</dt>
            <dd className="m-0 mt-1 break-words">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-6 border-t border-rule-2 pt-4 text-sm text-ink-2">Only the owner can change a manager&apos;s or the owner&apos;s details.</p>
    </Card>
  );
}

function DetailsForm({ person, me }: { person: Staff; me: Actor }) {
  const toast = useToast();
  const [problem, setProblem] = useState<string | null>(null);
  const isOwner = person.role === "owner";
  // The owner's role never changes; others' only within what this person may give.
  const roleChoices = isOwner ? [] : [...new Set([person.role as StaffInput["role"], ...rolesCreatableBy(me.role)])];
  const toValues = (p: Staff): DetailsValues => ({ fullName: p.fullName, email: p.email, phone: p.phone, ...(isOwner ? {} : { role: p.role as StaffInput["role"] }) });
  const { register, handleSubmit, setError, reset, formState } = useForm<DetailsValues>({ resolver: zodResolver(detailsSchema), values: toValues(person) });
  const update = useApiMutation((api, input: DetailsValues) => api.staff.update(person.id, input), [["staff"]]);
  const err = formState.errors;

  const onSubmit = handleSubmit(async (input) => {
    setProblem(null);
    try {
      const saved = await update.mutateAsync(input);
      reset(toValues(saved));
      toast("Details saved.");
    } catch (e) {
      if (e instanceof ApiError && e.code === "conflict") setError("email", { message: e.message }, { shouldFocus: true });
      else setProblem(errorMessage(e));
    }
  });

  return (
    <Card as="section">
      <h2 className="text-title tracking-normal">Details</h2>
      <form onSubmit={onSubmit} noValidate className="mt-5">
        <div className="grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-2">
          <Input label="Full name" autoComplete="off" error={err.fullName?.message} {...register("fullName")} />
          {isOwner ? (
            <Input label="Role" value="Owner" readOnly disabled hint="There is exactly one owner. This role cannot change." />
          ) : (
            <Select label="Role" error={err.role?.message} disabled={roleChoices.length < 2} hint={roleChoices.length < 2 ? "Only the owner can change roles." : undefined} {...register("role")}>
              {roleChoices.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </Select>
          )}
          <Input label="Email" type="email" autoComplete="off" inputMode="email" hint="They sign in with this. It must be unique." error={err.email?.message} {...register("email")} />
          <Input label="Phone" type="tel" autoComplete="off" inputMode="tel" error={err.phone?.message} {...register("phone")} />
        </div>
        <FormProblem message={problem} />
        <div className="mt-4 flex flex-wrap gap-3">
          <Button type="submit" loading={formState.isSubmitting} loadingLabel="Saving…" disabled={!formState.isDirty}>
            Save details
          </Button>
          {formState.isDirty ? (
            <Button variant="quiet" onClick={() => reset()}>
              Undo changes
            </Button>
          ) : null}
        </div>
      </form>
    </Card>
  );
}

// ---- access: active and password ---------------------------------------------------------------

function Access({ person, me }: { person: Staff; me: Actor }) {
  const { mode } = useApi();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [resetting, setResetting] = useState(false);
  const setActive = useApiMutation((api, active: boolean) => api.staff.update(person.id, { active }), [["staff"]]);
  const blockedDeactivate = person.active ? checkStaffChange(me, person, { active: false }) : checkStaffChange(me, person, { active: true });
  const blockedReset = checkPasswordReset(me, person);

  const toggle = async () => {
    try {
      await setActive.mutateAsync(!person.active);
      setConfirming(false);
      toast(person.active ? `${person.fullName} deactivated.` : `${person.fullName} can sign in again.`);
    } catch (e) {
      setConfirming(false);
      toast(errorMessage(e), "info");
    }
  };

  return (
    <Card as="section" dense>
      <h2 className="text-title tracking-normal">Access</h2>
      <dl className="m-0 mt-4 flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-sm text-muted">Status</dt>
          <dd className="m-0">
            <StatusBadge status={person.active ? "active" : "inactive"} />
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-sm text-muted">Last sign-in</dt>
          <dd className="m-0 text-right">{person.lastLoginAt ? formatDateTime(person.lastLoginAt) : "Never"}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-sm text-muted">Temporary password set</dt>
          <dd className="m-0 text-right">{person.passwordResetAt ? formatDateTime(person.passwordResetAt) : "Not since joining"}</dd>
        </div>
      </dl>

      <div className="mt-5 flex flex-col gap-4 border-t border-rule-2 pt-4">
        {blockedDeactivate ? (
          <p className="text-sm text-ink-2">{person.role === "owner" ? "The owner's account is always active." : blockedDeactivate}</p>
        ) : person.active ? (
          <Button variant="secondary" onClick={() => setConfirming(true)}>
            Deactivate
          </Button>
        ) : (
          <Button variant="secondary" loading={setActive.isPending} loadingLabel="Activating…" onClick={toggle}>
            Activate again
          </Button>
        )}
        {blockedReset ? (
          <p className="text-sm text-ink-2">{blockedReset}</p>
        ) : (
          <Button variant="secondary" onClick={() => setResetting(true)}>
            Reset password
          </Button>
        )}
        {mode === "mock" ? <p className="text-sm text-muted">Demo: sign-in uses the test accounts, so these changes do not affect who can sign in.</p> : null}
      </div>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={toggle}
        busy={setActive.isPending}
        danger
        title={`Deactivate ${person.fullName}?`}
        consequence="They will not be able to sign in. Their sales, payments and day plans stay as they are, and you can activate them again later."
        confirmLabel="Deactivate"
      />
      <ResetPassword person={person} open={resetting} onClose={() => setResetting(false)} />
    </Card>
  );
}

type ResetValues = { temporaryPassword: string; repeat: string };

function ResetPassword({ person, open, onClose }: { person: Staff; open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [show, setShow] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const { register, handleSubmit, setError, reset, formState } = useForm<ResetValues>({ defaultValues: { temporaryPassword: "", repeat: "" } });
  const resetPassword = useApiMutation((api, pw: string) => api.staff.resetPassword(person.id, pw), [["staff"]]);
  const err = formState.errors;

  const close = () => {
    reset();
    setProblem(null);
    setShow(false);
    onClose();
  };

  const onSubmit = handleSubmit(async (v) => {
    setProblem(null);
    const checked = temporaryPasswordField.safeParse(v.temporaryPassword);
    if (!checked.success) return setError("temporaryPassword", { message: firstIssue(checked.error) }, { shouldFocus: true });
    if (v.repeat !== v.temporaryPassword) return setError("repeat", { message: "The two passwords do not match." }, { shouldFocus: true });
    try {
      await resetPassword.mutateAsync(v.temporaryPassword);
      close();
      toast(`Temporary password set. Give it to ${person.fullName} in person.`);
    } catch (e) {
      setProblem(errorMessage(e));
    }
  });

  return (
    <Modal
      open={open}
      onClose={close}
      title={`Reset ${person.fullName}'s password`}
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Go back
          </Button>
          <Button type="submit" form="reset-password" loading={formState.isSubmitting} loadingLabel="Setting…">
            Set temporary password
          </Button>
        </>
      }
    >
      <form id="reset-password" onSubmit={onSubmit} noValidate>
        <p className="mb-4 text-ink-2">Their old password stops working. Type a temporary one, give it to them in person, and ask them to change it after they sign in.</p>
        <Input label="Temporary password" type={show ? "text" : "password"} autoComplete="new-password" hint="At least 8 characters." error={err.temporaryPassword?.message} {...register("temporaryPassword")} />
        <Input label="Type it again" type={show ? "text" : "password"} autoComplete="new-password" error={err.repeat?.message} {...register("repeat")} />
        <Checkbox label="Show passwords" checked={show} onChange={(e) => setShow(e.target.checked)} />
        <FormProblem message={problem} />
      </form>
    </Modal>
  );
}

// ---- history -------------------------------------------------------------------------------------

function History({ person }: { person: Staff }) {
  const isSalesman = person.role === "salesman";
  const filter = { salesmanId: person.id, pageSize: 1 };
  const sales = useApiQuery(["sales", "count", person.id], (api) => api.sales.list(filter), { enabled: isSalesman });
  const payments = useApiQuery(["payments", "count", person.id], (api) => api.payments.list(filter), { enabled: isSalesman });
  const plans = useApiQuery(["dayPlans", "count", person.id], (api) => api.dayPlans.list(filter), { enabled: isSalesman });
  const counts: [string, { isError: boolean; data?: { total: number } }][] = [
    ["Sales", sales],
    ["Payments collected", payments],
    ["Day plans", plans],
  ];
  return (
    <Card as="section" dense>
      <h2 className="text-title tracking-normal">History</h2>
      <p className="mt-2 text-sm text-ink-2">Kept for good. Deactivating someone never deletes their records.</p>
      {isSalesman ? (
        <dl className="m-0 mt-4 flex flex-col gap-3">
          {counts.map(([label, c]) => (
            <div key={label} className="flex items-baseline justify-between gap-4">
              <dt className="text-sm text-muted">{label}</dt>
              <dd className="m-0 font-outlier text-lg">{c.isError ? "Not loaded" : (c.data?.total ?? "…")}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </Card>
  );
}
