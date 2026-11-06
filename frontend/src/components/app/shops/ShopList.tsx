"use client";

// Shops: every shop with its route and balance. Search, route, overdue and status
// filters and the sort all live in the address.

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button, buttonClass } from "@/components/ui/Button";
import { Badge, MoneyText, PageHeader, StatusBadge } from "@/components/ui/Display";
import { Input, Select } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Controls";
import { PlusIcon } from "@/components/ui/icons";
import { ExportButton, Table, type Column } from "@/components/ui/Table";
import { errorMessage, useApiQuery } from "@/lib/api/provider";
import type { ShopWithBalance } from "@/lib/api/types";
import { formatAmount } from "@/lib/money";
import { formatSort, parseSort, useUrlState } from "@/lib/url-state";

const OVERDUE = [
  { value: "all", label: "All" },
  { value: "overdue", label: "Overdue" },
] as const;
const STATUS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
] as const;
const PAGE_SIZE = 200;
const plain = (paisa: number) => formatAmount(paisa).replace(/,/g, "");

function columnsFor(routeName: (id: string | null) => string): Column<ShopWithBalance>[] {
  return [
    {
      key: "name",
      header: "Shop",
      rowHeader: true,
      cell: (s) => (
        <span className="block min-w-40">
          <Link href={`/app/manager/shops/${s.id}`} className="text-link">
            {s.name}
          </Link>
        </span>
      ),
      sortValue: (s) => s.name,
    },
    { key: "owner", header: "Owner", cell: (s) => s.ownerName, sortValue: (s) => s.ownerName },
    { key: "phone", header: "Phone", cell: (s) => <span className="whitespace-nowrap">{s.phone}</span>, sortValue: (s) => s.phone },
    { key: "route", header: "Route", cell: (s) => (s.routeId ? routeName(s.routeId) : <span className="text-muted">No route</span>), sortValue: (s) => routeName(s.routeId) },
    { key: "balance", header: "Balance", numeric: true, cell: (s) => <MoneyText paisa={s.balancePaisa} balance />, sortValue: (s) => s.balancePaisa, csv: (s) => plain(s.balancePaisa) },
    {
      key: "flags",
      header: "Overdue",
      cell: (s) => (
        <span className="flex flex-wrap gap-1.5">
          {s.overduePaisa > 0 ? <StatusBadge status="overdue" /> : null}
        </span>
      ),
      sortValue: (s) => s.overduePaisa,
      csv: (s) => plain(s.overduePaisa),
    },
    { key: "status", header: "Status", cell: (s) => (s.active ? <StatusBadge status="active" /> : <Badge tone="stopped">Inactive</Badge>), sortValue: (s) => (s.active ? "Active" : "Inactive") },
  ];
}

export function ShopList() {
  const [url, setUrl] = useUrlState(["q", "route", "overdue", "status", "sort"] as const);
  const overdue = url.overdue === "overdue" ? "overdue" : "all";
  const status = url.status === "active" || url.status === "inactive" ? url.status : "all";

  const [search, setSearch] = useState(url.q);
  useEffect(() => {
    const t = setTimeout(() => {
      if (search.trim() !== url.q) setUrl({ q: search.trim() });
    }, 300);
    return () => clearTimeout(t);
  }, [search, url.q, setUrl]);

  const routes = useApiQuery(["routes", "list"], (api) => api.routes.list());
  const filter = useMemo(
    () => ({ search: url.q || undefined, routeId: url.route || undefined, overdue: overdue === "overdue" || undefined, active: status === "all" ? undefined : status === "active", pageSize: PAGE_SIZE }),
    [url.q, url.route, overdue, status],
  );
  const q = useApiQuery(["shops", "list", filter], (api) => api.shops.list(filter), { placeholderData: (prev) => prev });
  const columns = useMemo(() => columnsFor((id) => routes.data?.find((r) => r.id === id)?.name ?? (id ? "…" : "No route")), [routes.data]);
  const filtered = Boolean(url.q || url.route || overdue !== "all" || status !== "all");

  const clear = () => {
    setSearch("");
    setUrl({ q: "", route: "", overdue: "", status: "" });
  };

  return (
    <>
      <PageHeader
        title="Shops"
        lead="Every shop you supply, with what it owes."
        actions={
          <>
            <ExportButton filename="shops.csv" columns={columns} rows={q.data?.items} />
            <Link href="/app/manager/shops/new" className={buttonClass("primary", "sm")}>
              <PlusIcon className="size-4" />
              Add shop
            </Link>
          </>
        }
      />

      <div className="mb-2 grid grid-cols-1 gap-x-4 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-start">
        <div className="lg:w-72">
          <Input label="Search" type="search" size="sm" placeholder="Shop, owner, phone or PAN" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="lg:w-60">
          <Select label="Route" size="sm" value={url.route} onChange={(e) => setUrl({ route: e.target.value })}>
            <option value="">All routes</option>
            {routes.data?.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
            <option value="none">On no route</option>
          </Select>
        </div>
        <div className="flex flex-col gap-2 pb-7">
          <span className="font-medium">Overdue</span>
          <Segmented label="Overdue" value={overdue} onChange={(v) => setUrl({ overdue: v === "all" ? "" : v })} options={[...OVERDUE]} />
        </div>
        <div className="flex flex-col gap-2 pb-7">
          <span className="font-medium">Status</span>
          <Segmented label="Status" value={status} onChange={(v) => setUrl({ status: v === "all" ? "" : v })} options={[...STATUS]} />
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
        {q.data ? `${q.data.total} shop${q.data.total === 1 ? "" : "s"}${filtered ? " match" : ""}${q.data.total > PAGE_SIZE ? `, showing the first ${PAGE_SIZE}` : ""}` : " "}
      </p>

      <Table
        caption="Shops"
        columns={columns}
        rows={q.data?.items}
        rowKey={(s) => s.id}
        loading={q.isPending}
        error={q.isError ? errorMessage(q.error) : null}
        onRetry={() => q.refetch()}
        sort={parseSort(url.sort)}
        onSortChange={(s) => setUrl({ sort: formatSort(s) })}
        empty={
          filtered
            ? { title: "No shops match", line: "Try another search, or clear the filters.", action: <Button variant="secondary" size="sm" onClick={clear}>Clear filters</Button> }
            : { title: "No shops yet", line: "Add the shops you supply, then put them on routes.", action: <Link href="/app/manager/shops/new" className={buttonClass("secondary", "sm")}>Add shop</Link> }
        }
      />
    </>
  );
}
