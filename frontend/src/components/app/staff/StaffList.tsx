"use client";

// Staff list: everyone in the business, with role, status and last sign-in. Search, role and
// status filters and the sort all live in the address.

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button, buttonClass } from "@/components/ui/Button";
import { PageHeader, StatusBadge } from "@/components/ui/Display";
import { Input, Select } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Controls";
import { PlusIcon } from "@/components/ui/icons";
import { ExportButton, Table, type Column } from "@/components/ui/Table";
import { errorMessage, useApi, useApiQuery } from "@/lib/api/provider";
import { rolesCreatableBy } from "@/lib/api/mock/rules";
import type { Staff, StaffRole } from "@/lib/api/types";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatSort, parseSort, useUrlState } from "@/lib/url-state";
import { ROLE_LABEL } from "../labels";

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
] as const;
type StatusFilter = (typeof STATUS_OPTIONS)[number]["value"];

const columns: Column<Staff>[] = [
  {
    key: "name",
    header: "Name",
    rowHeader: true,
    cell: (s) => (
      <Link href={`/app/manager/staff/${s.id}`} className="text-link whitespace-nowrap">
        {s.fullName}
      </Link>
    ),
    sortValue: (s) => s.fullName,
  },
  { key: "role", header: "Role", cell: (s) => ROLE_LABEL[s.role], sortValue: (s) => ROLE_LABEL[s.role] },
  { key: "email", header: "Email", cell: (s) => s.email, sortValue: (s) => s.email },
  { key: "phone", header: "Phone", cell: (s) => <span className="whitespace-nowrap">{s.phone}</span>, sortValue: (s) => s.phone },
  { key: "status", header: "Status", cell: (s) => <StatusBadge status={s.active ? "active" : "inactive"} />, sortValue: (s) => (s.active ? "Active" : "Inactive") },
  {
    key: "lastLogin",
    header: "Last sign-in",
    cell: (s) => (s.lastLoginAt ? <span className="whitespace-nowrap">{formatDateTime(s.lastLoginAt)}</span> : <span className="text-muted">Never</span>),
    sortValue: (s) => s.lastLoginAt ?? "",
    csv: (s) => (s.lastLoginAt ? formatDateTime(s.lastLoginAt) : "Never"),
  },
  { key: "joined", header: "Joined", cell: (s) => <span className="whitespace-nowrap">{formatDate(s.joinedOn)}</span>, sortValue: (s) => s.joinedOn, csv: (s) => formatDate(s.joinedOn) },
];

export function StaffList() {
  const { viewer } = useApi();
  const [url, setUrl] = useUrlState(["q", "role", "status", "sort"] as const);
  const role = (["owner", "manager", "salesman"] as const).find((r) => r === url.role);
  const status: StatusFilter = url.status === "active" || url.status === "inactive" ? url.status : "all";

  // The search box updates the address a moment after typing stops.
  const [search, setSearch] = useState(url.q);
  useEffect(() => {
    const t = setTimeout(() => {
      if (search.trim() !== url.q) setUrl({ q: search.trim() });
    }, 300);
    return () => clearTimeout(t);
  }, [search, url.q, setUrl]);

  const filter = useMemo(() => ({ search: url.q || undefined, role, active: status === "all" ? undefined : status === "active" }), [url.q, role, status]);
  const q = useApiQuery(["staff", "list", filter], (api) => api.staff.list(filter), { placeholderData: (prev) => prev });
  const filtered = Boolean(url.q || role || status !== "all");
  const canAdd = viewer.type === "staff" && rolesCreatableBy(viewer.role).length > 0;

  const clear = () => {
    setSearch("");
    setUrl({ q: "", role: "", status: "" });
  };

  return (
    <>
      <PageHeader
        title="Staff"
        lead="Everyone who signs in for your business."
        actions={
          <>
            <ExportButton filename="staff.csv" columns={columns} rows={q.data} />
            {canAdd ? (
              <Link href="/app/manager/staff/new" className={buttonClass("primary", "sm")}>
                <PlusIcon className="size-4" />
                Add staff
              </Link>
            ) : null}
          </>
        }
      />

      <div className="mb-2 grid grid-cols-1 gap-x-4 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-start">
        <div className="lg:w-72">
          <Input label="Search" type="search" size="sm" placeholder="Name, email or phone" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="lg:w-52">
          <Select label="Role" size="sm" value={role ?? ""} onChange={(e) => setUrl({ role: e.target.value })}>
            <option value="">All roles</option>
            {(Object.keys(ROLE_LABEL) as StaffRole[]).map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <span className="font-medium">Status</span>
          <Segmented label="Status" value={status} onChange={(v) => setUrl({ status: v === "all" ? "" : v })} options={[...STATUS_OPTIONS]} />
        </div>
        {filtered ? (
          <div className="flex items-end self-stretch pb-7">
            <Button variant="quiet" size="sm" onClick={clear}>
              Clear filters
            </Button>
          </div>
        ) : null}
      </div>

      <p className="mb-3 text-sm text-muted" aria-live="polite">
        {q.data ? `${q.data.length} ${q.data.length === 1 ? "person" : "people"}${filtered ? " match" : ""}` : " "}
      </p>

      <Table
        caption="Staff"
        columns={columns}
        rows={q.data}
        rowKey={(s) => s.id}
        loading={q.isPending}
        error={q.isError ? errorMessage(q.error) : null}
        onRetry={() => q.refetch()}
        sort={parseSort(url.sort)}
        onSortChange={(s) => setUrl({ sort: formatSort(s) })}
        empty={
          filtered
            ? { title: "No staff match", line: "Try another search, or clear the filters.", action: <Button variant="secondary" size="sm" onClick={clear}>Clear filters</Button> }
            : { title: "No staff yet", line: "People you add show up here." }
        }
      />
    </>
  );
}
