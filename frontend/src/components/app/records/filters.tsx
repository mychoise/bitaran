"use client";

// Filter pieces shared by the manager's record lists: an optional date range and a salesman.

import { Input, Select } from "@/components/ui/Field";
import type { Staff } from "@/lib/api/types";

export const DATE = /^\d{4}-\d{2}-\d{2}$/;
export const okDate = (v: string) => (DATE.test(v) ? v : "");

export function DateFilter({ from, to, onChange }: { from: string; to: string; onChange: (patch: { from?: string; to?: string }) => void }) {
  return (
    <>
      <div className="lg:w-44">
        <Input label="From" type="date" size="sm" value={from} max={to || undefined} onChange={(e) => onChange({ from: e.target.value })} />
      </div>
      <div className="lg:w-44">
        <Input label="To" type="date" size="sm" value={to} min={from || undefined} onChange={(e) => onChange({ to: e.target.value })} />
      </div>
    </>
  );
}

export function SalesmanFilter({ salesmen, value, onChange }: { salesmen: Staff[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="lg:w-52">
      <Select label="Salesman" size="sm" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">All salesmen</option>
        {salesmen.map((s) => (
          <option key={s.id} value={s.id}>
            {s.fullName}
          </option>
        ))}
      </Select>
    </div>
  );
}
