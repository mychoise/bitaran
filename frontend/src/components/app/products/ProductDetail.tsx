"use client";

// One product: edit it, add a photo, adjust its stock, deactivate it. Products are never deleted.

import Link from "next/link";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Button, buttonClass } from "@/components/ui/Button";
import { Badge, Card, MoneyText, PageHeader, StatusBadge } from "@/components/ui/Display";
import { Input } from "@/components/ui/Field";
import { BackLink, FormProblem } from "@/components/ui/Form";
import { ImagePicker, type ImageChange } from "@/components/ui/ImagePicker";
import { ConfirmDialog, Modal, useToast } from "@/components/ui/Overlay";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { ApiError, type ProductUpdateInput } from "@/lib/api/client";
import { adjustStock, isLowStock, unitMargin } from "@/lib/api/mock/rules";
import { errorMessage, useApiMutation, useApiQuery } from "@/lib/api/provider";
import type { Product } from "@/lib/api/types";
import { SIGNED_WHOLE } from "@/lib/forms";
import { cartonEquivalent, countUnits, plural } from "@/lib/units";
import { fromProduct, ProductForm, toInput } from "./ProductForm";

/** Every change to a product refreshes product lists, category counts and the dashboard. */
const AFFECTS = [["products"], ["categories"], ["reports"]];

export function ProductDetail({ id }: { id: string }) {
  const q = useApiQuery(["products", "detail", id], (api) => api.products.get(id));
  if (q.isPending) return <LoadingState label="Loading this product" />;
  if (q.isError) {
    if (q.error instanceof ApiError && q.error.code === "not_found")
      return (
        <>
          <BackLink href="/app/manager/products" label="Products and stock" />
          <EmptyState
            title="This product was not found"
            line="It may have been added in another browser. Go back to the product list."
            action={
              <Link href="/app/manager/products" className={buttonClass("secondary", "sm")}>
                Back to products
              </Link>
            }
          />
        </>
      );
    return <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  }
  const p = q.data;
  return (
    <>
      <BackLink href="/app/manager/products" label="Products and stock" />
      <PageHeader
        title={p.name}
        lead={<span className="font-outlier">{p.sku}</span>}
        actions={
          <>
            {isLowStock(p) ? <Badge tone="warning">Low stock</Badge> : null}
            <StatusBadge status={p.active ? "active" : "inactive"} />
          </>
        }
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
        <div className="lg:col-span-2">
          <Details product={p} />
        </div>
        <div className="flex flex-col gap-6">
          <Stock product={p} />
          {p.costPricePaisa !== undefined ? <Margin product={p} /> : null}
          <Photo product={p} />
          <Status product={p} />
        </div>
      </div>
    </>
  );
}

function Details({ product }: { product: Product }) {
  const toast = useToast();
  const update = useApiMutation((api, input: ProductUpdateInput) => api.products.update(product.id, input), AFFECTS);
  return (
    <ProductForm
      mode="edit"
      product={product}
      submitLabel="Save changes"
      onSave={async (values) => {
        // Stock is not edited here; it moves through "Adjust stock".
        const saved = await update.mutateAsync(toInput(values));
        toast("Changes saved.");
        return fromProduct(saved);
      }}
    />
  );
}

// ---- stock ---------------------------------------------------------------------------------------

function Stock({ product: p }: { product: Product }) {
  const [open, setOpen] = useState(false);
  const cartons = cartonEquivalent(p.stockUnits, p.unitsPerCarton, p.unitName);
  return (
    <Card as="section" dense>
      <h2 className="text-title tracking-normal">Stock</h2>
      <p className="mt-3 font-outlier text-2xl leading-tight">{countUnits(p.stockUnits, p.unitName)}</p>
      <p className="mt-1 text-sm text-ink-2">{cartons ? `= ${cartons}` : "Not sold by the carton."}</p>
      <dl className="m-0 mt-4 flex items-baseline justify-between gap-4 border-t border-rule-2 pt-4">
        <dt className="text-sm text-muted">Low-stock level</dt>
        <dd className="m-0">{countUnits(p.lowStockUnits, p.unitName)}</dd>
      </dl>
      <Button variant="secondary" className="mt-4 w-full" onClick={() => setOpen(true)}>
        Adjust stock
      </Button>
      <AdjustStock product={p} open={open} onClose={() => setOpen(false)} />
    </Card>
  );
}

function AdjustStock({ product: p, open, onClose }: { product: Product; open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [problem, setProblem] = useState<string | null>(null);
  const { register, handleSubmit, setError, reset, control, formState } = useForm<{ delta: string }>({ defaultValues: { delta: "" } });
  const delta = useWatch({ control, name: "delta" });
  const adjust = useApiMutation((api, n: number) => api.products.adjustStock(p.id, n), AFFECTS);
  const n = SIGNED_WHOLE.test(delta) ? Number(delta) : null;
  const preview = n !== null ? adjustStock(p.stockUnits, n) : null;

  const close = () => {
    reset();
    setProblem(null);
    onClose();
  };

  const onSubmit = handleSubmit(async (v) => {
    setProblem(null);
    const checked = SIGNED_WHOLE.test(v.delta) ? adjustStock(p.stockUnits, Number(v.delta)) : { ok: false as const, reason: "Enter a whole number other than zero, like 24 or -6." };
    if (!checked.ok) return setError("delta", { message: checked.reason }, { shouldFocus: true });
    try {
      const saved = await adjust.mutateAsync(Number(v.delta));
      close();
      toast(`Stock is now ${countUnits(saved.stockUnits, saved.unitName)}.`);
    } catch (e) {
      setProblem(errorMessage(e));
    }
  });

  return (
    <Modal
      open={open}
      onClose={close}
      title="Adjust stock"
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Go back
          </Button>
          <Button type="submit" form="adjust-stock" loading={formState.isSubmitting} loadingLabel="Saving…">
            Save adjustment
          </Button>
        </>
      }
    >
      <form id="adjust-stock" onSubmit={onSubmit} noValidate>
        <p className="mb-4 text-ink-2">
          {p.name} has {countUnits(p.stockUnits, p.unitName)}. Add a number to raise stock, or a minus number to lower it. Stock cannot go below zero.
        </p>
        <Input label={`Change, in ${plural(p.unitName)}`} inputMode="numeric" autoComplete="off" placeholder="24 or -6" error={formState.errors.delta?.message} {...register("delta")} />
        <p className="mb-4 text-sm text-ink-2" aria-live="polite">
          {preview?.ok ? `New stock: ${countUnits(preview.stockUnits, p.unitName)}${cartonEquivalent(preview.stockUnits, p.unitsPerCarton, p.unitName) ? `, = ${cartonEquivalent(preview.stockUnits, p.unitsPerCarton, p.unitName)}` : ""}.` : " "}
        </p>
        <p className="rounded-input border border-rule-2 bg-paper-3 p-3 text-sm text-ink-2">
          <strong className="font-semibold text-ink">Adjustments are not logged yet.</strong> The stock changes, but there is no record of who changed it or why. Use it to correct a count, not to record sales or returns.
        </p>
        <FormProblem message={problem} />
      </form>
    </Modal>
  );
}

// ---- cost and margin (owner and managers only) ----------------------------------------------------

function Margin({ product: p }: { product: Product }) {
  const m = unitMargin(p.unitPricePaisa, p.costPricePaisa!);
  const cartonCost = p.unitsPerCarton !== null ? p.costPricePaisa! * p.unitsPerCarton : null;
  return (
    <Card as="section" dense>
      <h2 className="text-title tracking-normal">Cost and margin</h2>
      <dl className="m-0 mt-4 flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-sm text-muted">Cost per {p.unitName}</dt>
          <dd className="m-0">
            <MoneyText paisa={p.costPricePaisa!} />
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-sm text-muted">Margin per {p.unitName}</dt>
          <dd className={`m-0 ${m.paisa < 0 ? "text-error" : ""}`}>
            <MoneyText paisa={m.paisa} />
            {m.percent !== null ? <span className="ml-1 text-sm text-ink-2">({m.percent}%)</span> : null}
          </dd>
        </div>
        {cartonCost !== null && p.cartonPricePaisa !== null ? (
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-sm text-muted">Margin per carton</dt>
            <dd className={`m-0 ${p.cartonPricePaisa - cartonCost < 0 ? "text-error" : ""}`}>
              <MoneyText paisa={p.cartonPricePaisa - cartonCost} />
            </dd>
          </div>
        ) : null}
      </dl>
      <p className="mt-4 text-sm text-muted">Only the owner and managers see cost and margin.</p>
    </Card>
  );
}

// ---- photo and status ------------------------------------------------------------------------------

function Photo({ product: p }: { product: Product }) {
  const toast = useToast();
  const [change, setChange] = useState<ImageChange>({ kind: "keep" });
  const [problem, setProblem] = useState<string | null>(null);
  const save = useApiMutation(async (api, c: ImageChange) => {
    const imageId = c.kind === "new" ? (await api.uploads.image(c.blob)).id : null;
    return api.products.update(p.id, { imageId });
  }, AFFECTS);

  const onSave = async () => {
    setProblem(null);
    try {
      await save.mutateAsync(change);
      setChange({ kind: "keep" });
      toast(change.kind === "remove" ? "Photo removed." : "Photo saved.");
    } catch (e) {
      setProblem(errorMessage(e));
    }
  };

  return (
    <ImagePicker
      title="Photo"
      alt={`Photo of ${p.name}`}
      current={p.imageUrl}
      change={change}
      onChange={setChange}
      hint="PNG, JPEG or WebP, under 5 MB. Helps salesmen pick the right item."
      emptyText="No photo yet"
      maxPx={800}
      pendingText="not saved yet"
      footer={
        change.kind !== "keep" ? (
          <div className="mt-4 border-t border-rule-2 pt-4">
            <Button size="sm" loading={save.isPending} loadingLabel="Saving…" onClick={onSave}>
              {change.kind === "remove" ? "Remove photo" : "Save photo"}
            </Button>
            <FormProblem message={problem} />
          </div>
        ) : null
      }
    />
  );
}

function Status({ product: p }: { product: Product }) {
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const setActive = useApiMutation((api, active: boolean) => api.products.update(p.id, { active }), AFFECTS);
  const toggle = async () => {
    try {
      await setActive.mutateAsync(!p.active);
      toast(p.active ? `${p.name} deactivated.` : `${p.name} is active again.`);
    } catch (e) {
      toast(errorMessage(e), "info");
    } finally {
      setConfirming(false);
    }
  };
  return (
    <Card as="section" dense>
      <h2 className="text-title tracking-normal">Status</h2>
      <p className="mt-2 text-sm text-ink-2">
        {p.active ? "Active: it can be issued to salesmen and sold." : "Inactive: it is not issued or sold. Its past sales stay as they are."} Products are never deleted.
      </p>
      {p.active ? (
        <Button variant="secondary" className="mt-4 w-full" onClick={() => setConfirming(true)}>
          Deactivate
        </Button>
      ) : (
        <Button variant="secondary" className="mt-4 w-full" loading={setActive.isPending} loadingLabel="Activating…" onClick={toggle}>
          Activate again
        </Button>
      )}
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={toggle}
        busy={setActive.isPending}
        danger
        title={`Deactivate ${p.name}?`}
        consequence="It will not be issued to salesmen or sold. Its stock, past sales and returns stay as they are, and you can activate it again later."
        confirmLabel="Deactivate"
      />
    </Card>
  );
}
