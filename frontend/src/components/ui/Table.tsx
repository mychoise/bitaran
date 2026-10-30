"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Button } from "./Button";
import { Skeleton } from "./Display";
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, ChevronUpIcon, DownloadIcon, SortIcon } from "./icons";
import { EmptyState, ErrorState } from "./States";

export type Column<T> = {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** A value to sort by; leave out to make the column not sortable. */
  sortValue?: (row: T) => string | number;
  /** Plain text for CSV export; defaults to sortValue. */
  csv?: (row: T) => string | number;
  numeric?: boolean;
  /** The column that names the row (rendered as a row header). */
  rowHeader?: boolean;
};

export type SortState = { key: string; dir: "asc" | "desc" } | null;

type Props<T> = {
  caption: string;
  columns: Column<T>[];
  rows: T[] | undefined;
  rowKey: (row: T) => string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  empty?: { title: string; line: string; action?: ReactNode };
  /** Controlled sort, e.g. kept in the URL. Without it the table sorts itself. */
  sort?: SortState;
  onSortChange?: (s: SortState) => void;
};

/** A dense data table in a cotton card: sticky header, sortable columns, loading, empty and error states. */
export function Table<T>({ caption, columns, rows, rowKey, loading, error, onRetry, empty, sort: controlled, onSortChange }: Props<T>) {
  const [own, setOwn] = useState<SortState>(null);
  const sort = controlled !== undefined ? controlled : own;
  const setSort = (s: SortState) => (onSortChange ? onSortChange(s) : setOwn(s));

  const sorted = useMemo(() => {
    if (!rows || !sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    const get = col.sortValue;
    return [...rows].sort((a, b) => {
      const x = get(a), y = get(b);
      const r = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
      return sort.dir === "asc" ? r : -r;
    });
  }, [rows, sort, columns]);

  if (error) return <ErrorState message={error} onRetry={onRetry} />;

  return (
    <div className="stock rounded-stock">
      <div className="table-scroll">
        <table className="data-table">
          <caption className="visually-hidden">{caption}</caption>
          <thead>
            <tr>
              {columns.map((c) => {
                const active = sort?.key === c.key;
                return (
                  <th key={c.key} scope="col" className={c.numeric ? "num" : ""} aria-sort={active ? (sort!.dir === "asc" ? "ascending" : "descending") : undefined}>
                    {c.sortValue ? (
                      <button
                        type="button"
                        className="sort-btn"
                        data-active={active}
                        onClick={() => setSort(active && sort!.dir === "asc" ? { key: c.key, dir: "desc" } : active ? null : { key: c.key, dir: "asc" })}
                      >
                        {c.header}
                        {active ? sort!.dir === "asc" ? <ChevronUpIcon className="size-4" /> : <ChevronDownIcon className="size-4" /> : <SortIcon className="size-4" />}
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading || !sorted
              ? Array.from({ length: 5 }, (_, i) => (
                  <tr key={i}>
                    {columns.map((c) => (
                      <td key={c.key}>
                        <Skeleton className="h-4 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              : sorted.map((row) => (
                  <tr key={rowKey(row)}>
                    {columns.map((c) =>
                      c.rowHeader ? (
                        <th key={c.key} scope="row" className={`font-medium ${c.numeric ? "num" : ""}`}>
                          {c.cell(row)}
                        </th>
                      ) : (
                        <td key={c.key} className={c.numeric ? "num" : ""}>
                          {c.cell(row)}
                        </td>
                      ),
                    )}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
      {!loading && sorted && sorted.length === 0 ? (
        <div className="px-6">
          <EmptyState title={empty?.title ?? "Nothing here yet"} line={empty?.line ?? "When there is something to show, it will appear here."} action={empty?.action} />
        </div>
      ) : null}
    </div>
  );
}

/** Downloads the rows on screen as a CSV file (opens in Excel). */
export function exportCsv<T>(filename: string, columns: Column<T>[], rows: T[]) {
  const cell = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [columns.map((c) => cell(c.header)).join(","), ...rows.map((r) => columns.map((c) => cell((c.csv ?? c.sortValue)?.(r) ?? "")).join(","))];
  const blob = new Blob([`﻿${lines.join("\r\n")}`], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function ExportButton<T>({ filename, columns, rows }: { filename: string; columns: Column<T>[]; rows: T[] | undefined }) {
  return (
    <Button variant="secondary" size="sm" icon={<DownloadIcon className="size-4" />} disabled={!rows?.length} onClick={() => rows && exportCsv(filename, columns, rows)}>
      Export CSV
    </Button>
  );
}

export function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <nav aria-label="Pages" className="mt-4 flex items-center justify-between gap-4 text-sm">
      <span className="text-muted">
        {from} to {to} of {total}
      </span>
      <span className="flex items-center gap-2">
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)} icon={<ChevronLeftIcon className="size-4" />}>
          Previous
        </Button>
        <span className="px-2">
          Page {page} of {pages}
        </span>
        <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next
          <ChevronRightIcon className="size-4" />
        </Button>
      </span>
    </nav>
  );
}
