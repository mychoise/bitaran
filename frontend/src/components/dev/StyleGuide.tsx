"use client";

// Dev-only style guide: every kit component, with the website's own pieces beside the app's
// versions so they can be compared. Served at /dev/ui in development only.

import { io } from "next/cache";
import { use, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { DateRangePicker, ImageViewer, presetRange, Segmented, Stepper, Tabs, type Range } from "@/components/ui/Controls";
import { Badge, Card, MoneyText, PageHeader, Skeleton, Stat, StatusBadge } from "@/components/ui/Display";
import { Checkbox, Input, Select, Textarea } from "@/components/ui/Field";
import { ConfirmDialog, Drawer, Modal, ToastProvider, useToast } from "@/components/ui/Overlay";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { ExportButton, Pagination, Table, type Column } from "@/components/ui/Table";
import { TextField } from "@/components/forms/fields";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t-2 border-ink py-10">
      <h2 className="text-title tracking-normal">{title}</h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function Pair({ website, app }: { website: ReactNode; app: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <div>
        <p className="mb-3 text-sm text-muted">Website</p>
        {website}
      </div>
      <div>
        <p className="mb-3 text-sm text-muted">App kit</p>
        {app}
      </div>
    </div>
  );
}

type Row = { id: string; shop: string; route: string; balance: number; status: string };
const rows: Row[] = [
  { id: "1", shop: "Demo Kirana", route: "Bagar to Lamachaur", balance: 1240000, status: "overdue" },
  { id: "2", shop: "Demo Mart", route: "Chipledhunga to Lakeside", balance: -200000, status: "confirmed" },
  { id: "3", shop: "Demo Bhandar", route: "Bagar to Lamachaur", balance: 2500050, status: "over_limit" },
];
const columns: Column<Row>[] = [
  { key: "shop", header: "Shop", cell: (r) => r.shop, sortValue: (r) => r.shop, rowHeader: true },
  { key: "route", header: "Route", cell: (r) => r.route, sortValue: (r) => r.route },
  { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} />, csv: (r) => r.status },
  { key: "balance", header: "Balance", cell: (r) => <MoneyText paisa={r.balance} balance />, sortValue: (r) => r.balance, numeric: true, csv: (r) => (r.balance / 100).toFixed(2) },
];

function Demos() {
  use(io()); // the date range defaults read today's date: a per-request value
  const toast = useToast();
  const [modal, setModal] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [qty, setQty] = useState(3);
  const [method, setMethod] = useState<"cash" | "cheque" | "online">("cash");
  const [range, setRange] = useState<Range>(presetRange("week"));
  const [page, setPage] = useState(1);
  const [tableState, setTableState] = useState<"rows" | "loading" | "empty" | "error">("rows");

  return (
    <>
      <Section title="Headings">
        <Pair
          website={<h2>Made for how wholesale works</h2>}
          app={<PageHeader title="Payments" lead="Cheques and online payments waiting for you." actions={<Button size="sm">New payment</Button>} />}
        />
      </Section>

      <Section title="Buttons">
        <Pair
          website={
            <div className="flex flex-wrap gap-4">
              <ButtonLink href="#">Request a demo</ButtonLink>
              <ButtonLink href="#" variant="card">
                See a salesman&apos;s day
              </ButtonLink>
            </div>
          }
          app={
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-4">
                <Button>Save plan</Button>
                <Button variant="secondary">Cancel</Button>
                <Button variant="quiet">Clear filters</Button>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <Button size="sm">Small</Button>
                <Button size="lg">Large (salesman)</Button>
                <Button loading loadingLabel="Saving…">
                  Save
                </Button>
                <Button disabled>Disabled</Button>
              </div>
            </div>
          }
        />
      </Section>

      <Section title="Form fields">
        <Pair
          website={<TextField id="sg-site-phone" label="Phone" hint="As on the contact form" />}
          app={
            <div className="grid grid-cols-1 gap-2">
              <Input label="Shop name" placeholder="Demo Kirana" />
              <Input label="Cheque number" error="Enter the cheque number." />
              <Select label="Route" defaultValue="r1">
                <option value="r1">Bagar to Lamachaur</option>
                <option value="r2">Chipledhunga to Lakeside</option>
              </Select>
              <Input label="Search (small)" size="sm" />
              <Textarea label="Note" hint="Optional" />
              <Checkbox label="Restock this item" hint="Only for reason Other" />
            </div>
          }
        />
      </Section>

      <Section title="Cards and stats">
        <Pair
          website={
            <div className="stock rounded-stock p-8">
              <p className="text-title font-semibold">A website card</p>
              <p className="mt-2 text-ink-2">The cotton stationery card from the product samples.</p>
            </div>
          }
          app={
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Card dense>
                <Stat label="Sales today" value={<MoneyText paisa={3805000} />} note="14 invoices" />
              </Card>
              <Card dense>
                <Stat label="Loading" loading value={null} />
              </Card>
            </div>
          }
        />
      </Section>

      <Section title="Badges and money">
        <div className="flex flex-wrap gap-3">
          {["planned", "in_progress", "closed", "reconciled", "pending", "confirmed", "bounced", "cancelled", "overdue", "over_limit", "flagged"].map((s) => (
            <StatusBadge key={s} status={s} />
          ))}
          <Badge tone="success">Success</Badge>
          <Badge tone="warning">Warning</Badge>
          <Badge tone="danger">Danger</Badge>
        </div>
        <ul className="m-0 mt-6 flex list-none flex-col gap-2 p-0">
          <li>
            Owed: <MoneyText paisa={12345600} balance />
          </li>
          <li>
            Credit: <MoneyText paisa={-200000} balance />
          </li>
          <li>
            Amount: <MoneyText paisa={1234550} />
          </li>
        </ul>
      </Section>

      <Section title="Table">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Segmented label="Table state" value={tableState} onChange={setTableState} options={[{ value: "rows", label: "Rows" }, { value: "loading", label: "Loading" }, { value: "empty", label: "Empty" }, { value: "error", label: "Error" }]} />
          <ExportButton filename="demo-shops.csv" columns={columns} rows={rows} />
        </div>
        <Table
          caption="Demo shops"
          columns={columns}
          rows={tableState === "empty" ? [] : rows}
          rowKey={(r) => r.id}
          loading={tableState === "loading"}
          error={tableState === "error" ? "We could not reach the server. Please try again." : null}
          onRetry={() => setTableState("rows")}
          empty={{ title: "No shops match", line: "Try another route or clear the search." }}
        />
        <Pagination page={page} pageSize={25} total={60} onPage={setPage} />
      </Section>

      <Section title="Tabs and choices">
        <Tabs label="Demo tabs" items={[{ id: "a", label: "Overview", content: <p>Overview panel.</p> }, { id: "b", label: "Statement", content: <p>Statement panel.</p> }, { id: "c", label: "Photos", content: <p>Photos panel.</p> }]} />
        <div className="mt-6">
          <Segmented label="Payment method" value={method} onChange={setMethod} options={[{ value: "cash", label: "Cash" }, { value: "cheque", label: "Cheque" }, { value: "online", label: "Online" }]} />
        </div>
      </Section>

      <Section title="Stepper and date range">
        <div className="flex flex-col gap-8">
          <Stepper label="Quantity" value={qty} onChange={setQty} min={0} max={48} unit="cartons" />
          <DateRangePicker value={range} onChange={setRange} />
        </div>
      </Section>

      <Section title="Modal, drawer, confirm, toast">
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => setModal(true)}>
            Open modal
          </Button>
          <Button variant="secondary" onClick={() => setDrawer(true)}>
            Open drawer
          </Button>
          <Button variant="secondary" onClick={() => setConfirm(true)}>
            Open confirm
          </Button>
          <Button variant="secondary" onClick={() => toast("Payment confirmed.")}>
            Show toast
          </Button>
        </div>
        <Modal open={modal} onClose={() => setModal(false)} title="A modal" footer={<Button onClick={() => setModal(false)}>Done</Button>}>
          <p>Cotton card over an ink scrim. Escape or the scrim closes it.</p>
        </Modal>
        <Drawer open={drawer} onClose={() => setDrawer(false)} title="A drawer">
          <p>Slides from the right on desktop, from the bottom on phones.</p>
        </Drawer>
        <ConfirmDialog
          open={confirm}
          onClose={() => setConfirm(false)}
          onConfirm={() => {
            setConfirm(false);
            toast("Marked as bounced (demo only).", "info");
          }}
          danger
          title="Mark this cheque as bounced?"
          consequence="The shop's balance stays as it is, and this cannot be changed later."
          confirmLabel="Mark as bounced"
        />
      </Section>

      <Section title="Images">
        <div className="flex flex-wrap gap-4">
          <ImageViewer src="demo-img:cheque:1" alt="Cheque photo" />
          <ImageViewer src="demo-img:screenshot:2" alt="Payment screenshot" />
          <ImageViewer src="demo-img:shop:3" alt="Shop visit photo" />
        </div>
      </Section>

      <Section title="Empty, loading and error states">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <Card dense>
            <EmptyState title="No payments yet" line="Payments your salesmen collect show up here." action={<Button size="sm">Record a payment</Button>} />
          </Card>
          <Card dense>
            <LoadingState />
            <Skeleton className="h-24 w-full" />
          </Card>
          <ErrorState message="We could not reach the server. Please try again." onRetry={() => toast("Retrying (demo).", "info")} />
        </div>
      </Section>
    </>
  );
}

export function StyleGuide() {
  return (
    <ToastProvider>
      <main id="main" className="container py-section-s">
        <h1 className="text-display-s">App kit</h1>
        <p className="lead mt-4 text-ink-2">Development only. Website pieces sit beside the app versions for comparison.</p>
        <div className="mt-10">
          <Demos />
        </div>
      </main>
    </ToastProvider>
  );
}
