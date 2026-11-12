"use client";

// My sales, filterable by date range and shop. Filters live in the address.

import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { DateRangePicker, presetRange, type Range } from "@/components/ui/Controls";
import { MoneyText, StatusBadge } from "@/components/ui/Display";
import { Select } from "@/components/ui/Field";
import { ExportButton, Table, type Column } from "@/components/ui/Table";
import { useApi, useApiQuery, errorMessage } from "@/lib/api/provider";
import type { Sale } from "@/lib/api/types";
import { formatDate } from "@/lib/dates";
import { formatAmount, formatMoney } from "@/lib/money";
import { useUrlState } from "@/lib/url-state";
import { InvoiceItems } from "../records/InvoiceItems";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function History() {
  const t = useTranslations("Salesman.history");
  const { viewer } = useApi();
  const [url, setUrl] = useUrlState(["from", "to", "shop"] as const);
  const fallback = presetRange("month");
  const range: Range = { from: DATE.test(url.from) ? url.from : fallback.from, to: DATE.test(url.to) ? url.to : fallback.to };
  const shops = useApiQuery(["shops", "list", "all"], (api) => api.shops.list({ pageSize: 200 }));
  const filter = useMemo(() => ({ from: range.from, to: range.to, shopId: url.shop || undefined, salesmanId: viewer.id, pageSize: 200 }), [range.from, range.to, url.shop, viewer.id]);
  const q = useApiQuery(["sales", "list", filter], (api) => api.sales.list(filter), { placeholderData: (prev) => prev });
  const shopName = (id: string) => shops.data?.items.find((s) => s.id === id)?.name ?? "…";
  const confirmed = (q.data?.items ?? []).filter((s) => s.status === "confirmed");
  const columns: Column<Sale>[] = [
    { key: "no", header: t("invoice"), rowHeader: true, cell: (s) => <span className="font-outlier">{s.invoiceNo}</span>, sortValue: (s) => s.invoiceNo },
    { key: "date", header: t("date"), cell: (s) => <span className="whitespace-nowrap">{formatDate(s.date)}</span>, sortValue: (s) => s.date, csv: (s) => s.date },
    { key: "shop", header: t("shop"), cell: (s) => shopName(s.shopId), sortValue: (s) => shopName(s.shopId) },
    { key: "items", header: t("items"), cell: (s) => <InvoiceItems saleId={s.id} lines={s.lines} />, csv: (s) => s.lines.length || "" },
    { key: "total", header: t("total"), numeric: true, cell: (s) => <MoneyText paisa={s.totalPaisa} />, sortValue: (s) => s.totalPaisa, csv: (s) => formatAmount(s.totalPaisa).replace(/,/g, "") },
    { key: "status", header: t("status"), cell: (s) => <StatusBadge status={s.status} />, sortValue: (s) => s.status },
  ];
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-display-s">{t("title")}</h1>
      <p className="mt-2 text-lg text-ink-2">
        {q.data ? (
          t("summary", { count: confirmed.length, total: formatMoney(confirmed.reduce((a, s) => a + s.totalPaisa, 0)), from: formatDate(range.from), to: formatDate(range.to) })
        ) : (
          " "
        )}
      </p>
      <div className="mt-6 flex flex-wrap items-end gap-x-6 gap-y-3">
        <DateRangePicker value={range} onChange={(r) => setUrl({ from: r.from, to: r.to })} />
        <div className="w-64">
          <Select label={t("shop")} size="sm" value={url.shop} onChange={(e) => setUrl({ shop: e.target.value })}>
            <option value="">{t("allShops")}</option>
            {shops.data?.items.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="pb-7">
          <ExportButton filename="my-sales.csv" columns={columns} rows={q.data?.items} />
        </div>
      </div>
      <Table caption={t("caption")} columns={columns} rows={q.data?.items} rowKey={(s) => s.id} loading={q.isPending} error={q.isError ? errorMessage(q.error) : null} onRetry={() => q.refetch()} empty={{ title: t("noSalesTitle"), line: t("noSalesLine") }} />
    </div>
  );
}
