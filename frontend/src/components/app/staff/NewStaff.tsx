"use client";

// Add a person. The owner adds managers and salesmen; a manager adds salesmen only. The new
// account starts with a temporary password the manager types and gives them in person.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button, buttonClass } from "@/components/ui/Button";
import { Card, PageHeader } from "@/components/ui/Display";
import { Checkbox, Input, Select } from "@/components/ui/Field";
import { BackLink, FormProblem } from "@/components/ui/Form";
import { useToast } from "@/components/ui/Overlay";
import { ApiError, type StaffCreateInput } from "@/lib/api/client";
import { rolesCreatableBy } from "@/lib/api/mock/rules";
import { errorMessage, useApi, useApiMutation } from "@/lib/api/provider";
import { staffCreateSchema } from "@/lib/api/schemas";
import { zodResolver } from "@/lib/forms";
import { ROLE_LABEL } from "../labels";

export function NewStaff() {
  const { viewer } = useApi();
  const router = useRouter();
  const toast = useToast();
  const roles = viewer.type === "staff" ? rolesCreatableBy(viewer.role) : [];
  const [showPassword, setShowPassword] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const { register, handleSubmit, setError, formState } = useForm<StaffCreateInput>({
    resolver: zodResolver(staffCreateSchema),
    defaultValues: { fullName: "", role: roles[roles.length - 1] ?? "salesman", email: "", phone: "", temporaryPassword: "" },
  });
  const create = useApiMutation((api, input: StaffCreateInput) => api.staff.create(input), [["staff"]]);
  const err = formState.errors;

  const onSubmit = handleSubmit(async (values) => {
    setProblem(null);
    try {
      const person = await create.mutateAsync(values);
      toast(`${person.fullName} added. Give them their temporary password in person.`);
      router.push(`/app/manager/staff/${person.id}`);
    } catch (e) {
      if (e instanceof ApiError && e.code === "conflict") setError("email", { message: e.message }, { shouldFocus: true });
      else setProblem(errorMessage(e));
    }
  });

  return (
    <>
      <BackLink href="/app/manager/staff" label="Staff" />
      <PageHeader title="Add staff" lead={roles.length > 1 ? "Add a manager or a salesman." : "Managers can add salesmen."} />
      <form onSubmit={onSubmit} noValidate className="max-w-3xl">
        <Card>
          <div className="grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-2">
            <Input label="Full name" autoComplete="off" error={err.fullName?.message} {...register("fullName")} />
            <Select label="Role" error={err.role?.message} hint={roles.length === 1 ? "Managers can add salesmen only." : undefined} {...register("role")}>
              {roles.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </Select>
            <Input label="Email" type="email" autoComplete="off" inputMode="email" hint="They sign in with this. It must be unique." error={err.email?.message} {...register("email")} />
            <Input label="Phone" type="tel" autoComplete="off" inputMode="tel" error={err.phone?.message} {...register("phone")} />
          </div>
          <div className="mt-2 border-t border-rule-2 pt-6">
            <Input
              label="Temporary password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              hint="At least 8 characters. Give it to them in person, and ask them to change it after they sign in."
              error={err.temporaryPassword?.message}
              {...register("temporaryPassword")}
            />
            <Checkbox label="Show password" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} />
          </div>
        </Card>
        <FormProblem message={problem} />
        <div className="mt-6 flex flex-wrap gap-3">
          <Button type="submit" loading={formState.isSubmitting} loadingLabel="Adding…">
            Add staff
          </Button>
          <Link href="/app/manager/staff" className={buttonClass("secondary")}>
            Cancel
          </Link>
        </div>
      </form>
    </>
  );
}
