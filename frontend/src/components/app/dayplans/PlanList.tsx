"use client";

// Day plans: every salesman's day, newest first. Filter by date (with a Today shortcut),
// salesman and status; the filters and sort live in the address.

import Link from "next/link";
import { useMemo } from "react";
import { Button, buttonClass } from "@/components/ui/Button";
import { PageHeader, StatusBadge } from "@/components/ui/Display";
import { Input, Select } from "@/components/ui/Field";
import { PlusIcon } from "@/components/ui/icons";
import { ExportButton, Table, type Column } from "@/components/ui/Table";
import { errorMessage, useApiQuery } from "@/lib/api/provider";
import type { DayPlan, DayPlanStatus } from "@/lib/api/types";
import { formatDate, todayNepal } from "@/lib/dates";
import { formatSort, parseSort, useUrlState } from "@/lib/url-state";
import { usePlanLookups } from "./lookups";

const STATUSES: { value: DayPlanStatus; label: string }[] = [
  { value: "planned", label: "Planned" },
  { value: "in_progress", label: "In progress" },
  { value: "closed", label: "Closed, to count" },
  { value: "reconciled", label: "Reconciled" },
];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function PlanList() {
  const look = usePlanLookups();
  const [url, setUrl] = useUrlState(["date", "salesman", "status", "sort"] as const);
  const date = DATE.test(url.date) ? url.date : "";
  const status = STATUSES.find((s) => s.value === url.status)?.value;
  const today = todayNepal();
  const filter = useMemo(() => ({ from: date || undefined, to: date || undefined, salesmanId: url.salesman || undefined, status, pageSize: 200 }), [date, url.salesman, status]);
  const q = useApiQuery(["dayPlans", "list", filter], (api) => api.dayPlans.list(filter), { placeholderData: (prev) => prev });
  const filtered = Boolean(date || url.salesman || status);

  const columns: Column<DayPlan>[] = [
    {
      key: "date",
      header: "Date",
      rowHeader: true,
      cell: (p) => (
        <Link href={`/app/manager/day-plans/${p.id}`} className="text-link whitespace-nowrap">
          {formatDate(p.date)}
          {p.date === today ? " (today)" : ""}
        </Link>
      ),
      sortValue: (p) => p.date,
      csv: (p) => p.date,
    },
    { key: "salesman", header: "Salesman", cell: (p) => look.person(p.salesmanId), sortValue: (p) => look.person(p.salesmanId) },
    { key: "route", header: "Route", cell: (p) => look.route(p.routeId)?.name ?? "…", sortValue: (p) => look.route(p.routeId)?.name ?? "" },
    { key: "status", header: "Status", cell: (p) => <StatusBadge status={p.status} />, sortValue: (p) => STATUSES.findIndex((s) => s.value === p.status), csv: (p) => p.status },
    {
      key: "visits",
      header: "Shops done",
      numeric: true,
      cell: (p) => `${p.visits.filter((v) => v.status !== "pending").length} of ${p.visits.length}`,
      sortValue: (p) => p.visits.filter((v) => v.status !== "pending").length,
    },
    { key: "stock", header: "Products issued", numeric: true, cell: (p) => p.issued.length, sortValue: (p) => p.issued.length },
    {
      key: "next",
      header: "Next",
      cell: (p) =>
        p.status === "closed" ? (
          <Link href={`/app/manager/day-plans/${p.id}/reconcile`} className={buttonClass("secondary", "sm")}>
            Reconcile
          </Link>
        ) : p.status === "reconciled" ? (
          <Link href={`/app/manager/day-plans/${p.id}/reconcile`} className="text-link text-sm">
            Report
          </Link>
        ) : null,
      csv: () => "",
    },
  ];

  return (
    <>
      <PageHeader
        title="Day plans"
        lead="Each salesman's route and stock for the day, from the morning issue to the evening count."
        actions={
          <>
            <ExportButton filename="day-plans.csv" columns={columns.filter((c) => c.key !== "next")} rows={q.data?.items} />
            <Link href="/app/manager/day-plans/new" className={buttonClass("primary", "sm")}>
              <PlusIcon className="size-4" />
              New day plan
            </Link>
          </>
        }
      />

      <div className="mb-2 grid grid-cols-1 gap-x-4 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-start">
        <div className="lg:w-52">
          <Input label="Date" type="date" size="sm" value={date} onChange={(e) => setUrl({ date: e.target.value })} />
        </div>
        <div className="flex items-end self-stretch pb-7">
          <Button variant={date === today ? "primary" : "secondary"} size="sm" aria-pressed={date === today} onClick={() => setUrl({ date: date === today ? "" : today })}>
            Today
          </Button>
        </div>
        <div className="lg:w-56">
          <Select label="Salesman" size="sm" value={url.salesman} onChange={(e) => setUrl({ salesman: e.target.value })}>
            <option value="">All salesmen</option>
            {look.salesmen.map((s) => (
              <option key={s.id} value={s.id}>
                {s.fullName}
              </option>
            ))}
          </Select>
        </div>
        <div className="lg:w-52">
          <Select label="Status" size="sm" value={status ?? ""} onChange={(e) => setUrl({ status: e.target.value })}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </div>
        {filtered ? (
          <div className="flex items-end self-stretch pb-7">
            <Button variant="quiet" size="sm" onClick={() => setUrl({ date: "", salesman: "", status: "" })}>
              Clear filters
            </Button>
          </div>
        ) : null}
      </div>

      <p className="mb-3 text-sm text-muted" aria-live="polite">
        {q.data ? `${q.data.total} day plan${q.data.total === 1 ? "" : "s"}${filtered ? " match" : ""}` : " "}
      </p>

      <Table
        caption="Day plans"
        columns={columns}
        rows={q.data?.items}
        rowKey={(p) => p.id}
        loading={q.isPending}
        error={q.isError ? errorMessage(q.error) : null}
        onRetry={() => q.refetch()}
        sort={parseSort(url.sort)}
        onSortChange={(s) => setUrl({ sort: formatSort(s) })}
        empty={
          filtered
            ? { title: "No day plans match", line: date ? `Nothing for ${formatDate(date)} with these filters.` : "Try other filters, or clear them.", action: <Button variant="secondary" size="sm" onClick={() => setUrl({ date: "", salesman: "", status: "" })}>Clear filters</Button> }
            : { title: "No day plans yet", line: "Make the first one: a salesman, a route and the stock they carry.", action: <Link href="/app/manager/day-plans/new" className={buttonClass("secondary", "sm")}>New day plan</Link> }
        }
      />
    </>
  );
}
