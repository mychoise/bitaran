"use client";

// Visit photos for review: a grid filtered by date, salesman and "flagged only". Each shows the
// stamped picture (open to zoom), any flags in plain words, the distance and time, and a link to
// the visit's day plan. Flags ask for a look; they are not faults.

import Link from "next/link";
import { useMemo } from "react";
import { Button } from "@/components/ui/Button";
import { ImageViewer } from "@/components/ui/Controls";
import { Badge, Card, PageHeader } from "@/components/ui/Display";
import { Checkbox } from "@/components/ui/Field";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { errorMessage, useApiQuery } from "@/lib/api/provider";
import { formatDateTime } from "@/lib/dates";
import { useUrlState } from "@/lib/url-state";
import { usePlanLookups } from "../dayplans/lookups";
import { PHOTO_FLAG } from "../labels";
import { DateFilter, okDate, SalesmanFilter } from "./filters";

export function PhotoReview() {
  const look = usePlanLookups();
  const [url, setUrl] = useUrlState(["from", "to", "salesman", "flagged"] as const);
  const flagged = url.flagged === "1";
  const filter = useMemo(() => ({ from: okDate(url.from) || undefined, to: okDate(url.to) || undefined, salesmanId: url.salesman || undefined, flagged: flagged || undefined, pageSize: 120 }), [url.from, url.to, url.salesman, flagged]);
  const q = useApiQuery(["photos", "list", filter], (api) => api.photos.list(filter), { placeholderData: (prev) => prev });
  const filtered = Boolean(url.from || url.to || url.salesman || flagged);

  return (
    <>
      <PageHeader title="Visit photos" lead="Proof of each visit. Flags mark photos worth a second look; they never stopped a photo being saved." />
      <div className="mb-4 grid grid-cols-1 gap-x-4 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-start">
        <DateFilter from={okDate(url.from)} to={okDate(url.to)} onChange={setUrl} />
        <SalesmanFilter salesmen={look.salesmen} value={url.salesman} onChange={(v) => setUrl({ salesman: v })} />
        <div className="flex items-end self-stretch pb-7">
          <Checkbox label="Flagged only" checked={flagged} onChange={(e) => setUrl({ flagged: e.target.checked ? "1" : "" })} />
        </div>
        {filtered ? (
          <div className="flex items-end self-stretch pb-7">
            <Button variant="quiet" size="sm" onClick={() => setUrl({ from: "", to: "", salesman: "", flagged: "" })}>
              Clear filters
            </Button>
          </div>
        ) : null}
      </div>
      {q.isPending ? (
        <LoadingState label="Loading photos" />
      ) : q.isError ? (
        <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
      ) : q.data.items.length === 0 ? (
        <EmptyState title={flagged ? "Nothing flagged" : "No photos"} line={flagged ? "No photo in these dates needs a second look." : "Visit photos your salesmen take show up here."} />
      ) : (
        <>
          <p className="mb-3 text-sm text-muted" aria-live="polite">
            {q.data.total} photo{q.data.total === 1 ? "" : "s"}
            {q.data.total > q.data.items.length ? `, showing the newest ${q.data.items.length}` : ""}
          </p>
          <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 xl:grid-cols-3">
            {q.data.items.map((p) => {
              const shop = look.shop(p.shopId);
              return (
                <li key={p.id}>
                  <Card dense className="flex h-full flex-col gap-3">
                    <ImageViewer src={p.imageUrl ?? p.imageId} alt={`Visit photo at ${shop?.name ?? "a shop"}, ${formatDateTime(p.takenAt)}`} thumbClassName="h-48 w-full" />
                    <div>
                      <p className="font-medium">{shop?.name ?? "…"}</p>
                      <p className="text-sm text-ink-2">
                        {look.person(p.salesmanId)} · {formatDateTime(p.takenAt)}
                      </p>
                      <p className="text-sm text-muted">{p.distanceM === undefined ? "No location sent" : `${p.distanceM} m from the shop's saved location`}</p>
                      {p.note ? <p className="mt-1 text-sm">“{p.note}”</p> : null}
                    </div>
                    {p.flags.length ? (
                      <ul className="m-0 flex list-none flex-col gap-1.5 p-0" aria-label="Why it is flagged">
                        {p.flags.map((f) => (
                          <li key={f}>
                            <Badge tone="warning">{PHOTO_FLAG[f].short}</Badge>
                            <span className="mt-0.5 block text-sm text-ink-2">{PHOTO_FLAG[f].line}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <Link href={`/app/manager/day-plans/${p.planId}`} className="text-link mt-auto text-sm">
                      See the visit on its day plan
                    </Link>
                  </Card>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </>
  );
}
