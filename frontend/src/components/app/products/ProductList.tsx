"use client";

// Products and stock: every product with its prices and warehouse stock. Search, category,
// stock and status filters and the sort all live in the address.

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button, buttonClass } from "@/components/ui/Button";
import { Badge, MoneyText, PageHeader, StatusBadge } from "@/components/ui/Display";
import { Input, Select } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Controls";
import { PlusIcon } from "@/components/ui/icons";
import { ExportButton, Table, type Column } from "@/components/ui/Table";
import { isLowStock } from "@/lib/api/mock/rules";
import { errorMessage, useApiQuery } from "@/lib/api/provider";
import type { Category, Product } from "@/lib/api/types";
import { formatAmount } from "@/lib/money";
import { cartonEquivalent, countUnits } from "@/lib/units";
import { formatSort, parseSort, useUrlState } from "@/lib/url-state";

const STATUS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
] as const;
const STOCK = [
  { value: "all", label: "All stock" },
  { value: "low", label: "Low stock" },
] as const;

/** The list shows up to this many products at once, so sorting and export cover all of them. */
const PAGE_SIZE = 200;

function columnsFor(categoryName: (id: string) => string): Column<Product>[] {
  return [
    {
      key: "name",
      header: "Name",
      rowHeader: true,
      cell: (p) => (
        <span className="block min-w-44">
          <Link href={`/app/manager/products/${p.id}`} className="text-link">
            {p.name}
          </Link>
        </span>
      ),
      sortValue: (p) => p.name,
    },
    { key: "sku", header: "SKU", cell: (p) => <span className="whitespace-nowrap font-outlier text-sm">{p.sku}</span>, sortValue: (p) => p.sku },
    { key: "category", header: "Category", cell: (p) => categoryName(p.categoryId), sortValue: (p) => categoryName(p.categoryId) },
    { key: "unit", header: "Unit", cell: (p) => p.unitName, sortValue: (p) => p.unitName },
    { key: "price", header: "Price", numeric: true, cell: (p) => <MoneyText paisa={p.unitPricePaisa} />, sortValue: (p) => p.unitPricePaisa, csv: (p) => formatAmount(p.unitPricePaisa).replace(/,/g, "") },
    {
      key: "carton",
      header: "Carton price",
      numeric: true,
      cell: (p) =>
        p.cartonPricePaisa === null ? (
          <span className="text-muted">Not sold</span>
        ) : (
          <span className="flex flex-col items-end">
            <MoneyText paisa={p.cartonPricePaisa} />
            <span className="text-xs text-muted">{countUnits(p.unitsPerCarton!, p.unitName)}</span>
          </span>
        ),
      sortValue: (p) => p.cartonPricePaisa ?? -1,
      csv: (p) => (p.cartonPricePaisa === null ? "" : formatAmount(p.cartonPricePaisa).replace(/,/g, "")),
    },
    {
      key: "stock",
      header: "Stock",
      numeric: true,
      cell: (p) => (
        <span className="flex flex-col items-end">
          <span className="whitespace-nowrap">{countUnits(p.stockUnits, p.unitName)}</span>
          {cartonEquivalent(p.stockUnits, p.unitsPerCarton, p.unitName) ? <span className="whitespace-nowrap text-xs text-muted">{cartonEquivalent(p.stockUnits, p.unitsPerCarton, p.unitName)}</span> : null}
          {isLowStock(p) ? (
            <span className="mt-1">
              <Badge tone="warning">Low stock</Badge>
            </span>
          ) : null}
        </span>
      ),
      sortValue: (p) => p.stockUnits,
    },
    { key: "low", header: "Low stock", csvOnly: true, cell: () => null, csv: (p) => (isLowStock(p) ? "Yes" : "No") },
    { key: "active", header: "Status", cell: (p) => <StatusBadge status={p.active ? "active" : "inactive"} />, sortValue: (p) => (p.active ? "Active" : "Inactive") },
  ];
}

export function ProductList() {
  const [url, setUrl] = useUrlState(["q", "category", "stock", "status", "sort"] as const);
  const status = url.status === "active" || url.status === "inactive" ? url.status : "all";
  const stock = url.stock === "low" ? "low" : "all";

  const [search, setSearch] = useState(url.q);
  useEffect(() => {
    const t = setTimeout(() => {
      if (search.trim() !== url.q) setUrl({ q: search.trim() });
    }, 300);
    return () => clearTimeout(t);
  }, [search, url.q, setUrl]);

  const categories = useApiQuery(["categories", "list"], (api) => api.categories.list());
  const filter = useMemo(
    () => ({ search: url.q || undefined, categoryId: url.category || undefined, lowStock: stock === "low" || undefined, active: status === "all" ? undefined : status === "active", pageSize: PAGE_SIZE }),
    [url.q, url.category, stock, status],
  );
  const q = useApiQuery(["products", "list", filter], (api) => api.products.list(filter), { placeholderData: (prev) => prev });
  const byId = useMemo(() => new Map((categories.data ?? []).map((c: Category) => [c.id, c.name])), [categories.data]);
  const columns = useMemo(() => columnsFor((id) => byId.get(id) ?? "…"), [byId]);
  const filtered = Boolean(url.q || url.category || stock !== "all" || status !== "all");
  const rows = q.data?.items;

  const clear = () => {
    setSearch("");
    setUrl({ q: "", category: "", stock: "", status: "" });
  };

  return (
    <>
      <PageHeader
        title="Products and stock"
        lead="Prices and warehouse stock. Stock is counted in each product's unit."
        actions={
          <>
            <Link href="/app/manager/products/categories" className={buttonClass("secondary", "sm")}>
              Categories
            </Link>
            <ExportButton filename="products.csv" columns={columns} rows={rows} />
            <Link href="/app/manager/products/new" className={buttonClass("primary", "sm")}>
              <PlusIcon className="size-4" />
              Add product
            </Link>
          </>
        }
      />

      <div className="mb-2 grid grid-cols-1 gap-x-4 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-start">
        <div className="lg:w-72">
          <Input label="Search" type="search" size="sm" placeholder="Name or SKU" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="lg:w-56">
          <Select label="Category" size="sm" value={url.category} onChange={(e) => setUrl({ category: e.target.value })}>
            <option value="">All categories</option>
            {categories.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-2 pb-7">
          <span className="font-medium">Stock</span>
          <Segmented label="Stock" value={stock} onChange={(v) => setUrl({ stock: v === "all" ? "" : v })} options={[...STOCK]} />
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
        {q.data ? `${q.data.total} product${q.data.total === 1 ? "" : "s"}${filtered ? " match" : ""}${q.data.total > PAGE_SIZE ? `, showing the first ${PAGE_SIZE}` : ""}` : " "}
      </p>

      <Table
        caption="Products"
        columns={columns}
        rows={rows}
        rowKey={(p) => p.id}
        loading={q.isPending}
        error={q.isError ? errorMessage(q.error) : null}
        onRetry={() => q.refetch()}
        sort={parseSort(url.sort)}
        onSortChange={(s) => setUrl({ sort: formatSort(s) })}
        empty={
          filtered
            ? { title: "No products match", line: "Try another search, or clear the filters.", action: <Button variant="secondary" size="sm" onClick={clear}>Clear filters</Button> }
            : { title: "No products yet", line: "Add your first product to start issuing stock and selling.", action: <Link href="/app/manager/products/new" className={buttonClass("secondary", "sm")}>Add product</Link> }
        }
      />
    </>
  );
}
