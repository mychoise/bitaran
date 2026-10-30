"use client";

// The product form, for adding and for editing. Prices are typed in rupees and kept as paisa.
// Stock is typed only once, as opening stock; after that it moves through "Adjust stock".

import Link from "next/link";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Card, MoneyText } from "@/components/ui/Display";
import { Checkbox, Input, Select } from "@/components/ui/Field";
import { FormProblem } from "@/components/ui/Form";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { ApiError, type ProductInput } from "@/lib/api/client";
import { unitMargin } from "@/lib/api/mock/rules";
import { errorMessage, useApiQuery } from "@/lib/api/provider";
import { requiredText, skuField } from "@/lib/api/schemas";
import type { Category, Product } from "@/lib/api/types";
import { WHOLE, zodResolver } from "@/lib/forms";
import { formatAmount, parseRupees } from "@/lib/money";
import { cartonEquivalent, countUnits, plural } from "@/lib/units";

export type ProductFormValues = {
  name: string;
  sku: string;
  categoryId: string;
  unitName: string;
  price: string;
  cost: string;
  byCarton: boolean;
  unitsPerCarton: string;
  cartonPrice: string;
  lowStock: string;
  openingStock: string;
};

const rupees = (what: string) => z.string().refine((v) => parseRupees(v) !== null, `Enter the ${what} in rupees, like 45 or 45.50.`);
const whole = (what: string) => z.string().regex(WHOLE, `Enter the ${what} as a whole number, like 24.`);

const fields = {
  name: requiredText("product name", 120),
  sku: skuField,
  categoryId: z.string().min(1, "Choose a category."),
  unitName: requiredText("unit", 30),
  price: rupees("price"),
  cost: rupees("cost price"),
  byCarton: z.boolean(),
  unitsPerCarton: z.string(),
  cartonPrice: z.string(),
  lowStock: whole("low-stock level"),
};

/** Units per carton above zero and a carton price, but only when selling by the carton. */
const cartonRule = (v: ProductFormValues, ctx: z.RefinementCtx) => {
  if (!v.byCarton) return;
  if (!WHOLE.test(v.unitsPerCarton) || Number(v.unitsPerCarton) <= 0) ctx.addIssue({ code: "custom", path: ["unitsPerCarton"], message: "Units per carton must be a whole number above zero." });
  if (parseRupees(v.cartonPrice) === null) ctx.addIssue({ code: "custom", path: ["cartonPrice"], message: "Enter the carton price in rupees, like 1,350." });
};

const createSchema = z.object({ ...fields, openingStock: whole("opening stock") }).superRefine(cartonRule);
const editSchema = z.object({ ...fields, openingStock: z.string() }).superRefine(cartonRule);

export const fromProduct = (p: Product): ProductFormValues => ({
  name: p.name,
  sku: p.sku,
  categoryId: p.categoryId,
  unitName: p.unitName,
  price: formatAmount(p.unitPricePaisa),
  cost: p.costPricePaisa === undefined ? "" : formatAmount(p.costPricePaisa),
  byCarton: p.unitsPerCarton !== null,
  unitsPerCarton: p.unitsPerCarton === null ? "" : String(p.unitsPerCarton),
  cartonPrice: p.cartonPricePaisa === null ? "" : formatAmount(p.cartonPricePaisa),
  lowStock: String(p.lowStockUnits),
  openingStock: String(p.stockUnits),
});

const EMPTY: ProductFormValues = { name: "", sku: "", categoryId: "", unitName: "", price: "", cost: "", byCarton: true, unitsPerCarton: "", cartonPrice: "", lowStock: "0", openingStock: "0" };

/** Form values (already checked) as the API's input. Stock is added only on create. */
export function toInput(v: ProductFormValues): Omit<ProductInput, "active" | "stockUnits"> {
  return {
    name: v.name.trim(),
    sku: v.sku.trim(),
    categoryId: v.categoryId,
    unitName: v.unitName.trim(),
    unitPricePaisa: parseRupees(v.price)!,
    costPricePaisa: parseRupees(v.cost)!,
    unitsPerCarton: v.byCarton ? Number(v.unitsPerCarton) : null,
    cartonPricePaisa: v.byCarton ? parseRupees(v.cartonPrice)! : null,
    lowStockUnits: Number(v.lowStock),
  };
}

type FormProps = {
  mode: "create" | "edit";
  product?: Product;
  /** Saves; throws an ApiError to show it on the form. Returns the saved values to reset to. */
  onSave: (values: ProductFormValues) => Promise<ProductFormValues | void>;
  submitLabel: string;
  footer?: React.ReactNode;
};

/** Waits for the categories, so the category list has its options before the form sets a value. */
export function ProductForm(props: FormProps) {
  const categories = useApiQuery(["categories", "list"], (api) => api.categories.list());
  if (categories.isPending) return <LoadingState label="Loading categories" />;
  if (categories.isError) return <ErrorState message={errorMessage(categories.error)} onRetry={() => categories.refetch()} />;
  return <FormBody {...props} categories={categories.data} />;
}

function FormBody({ mode, product, onSave, submitLabel, footer, categories }: FormProps & { categories: Category[] }) {
  const [problem, setProblem] = useState<string | null>(null);
  const { register, handleSubmit, setError, reset, control, formState } = useForm<ProductFormValues>({
    resolver: zodResolver(mode === "create" ? createSchema : editSchema),
    values: product ? fromProduct(product) : undefined,
    defaultValues: product ? undefined : EMPTY,
  });
  const v = useWatch({ control });
  const err = formState.errors;
  const unit = v.unitName?.trim() || "unit";
  const units = plural(unit);
  const showCost = mode === "create" || product?.costPricePaisa !== undefined;

  const price = parseRupees(v.price ?? "");
  const cost = parseRupees(v.cost ?? "");
  const margin = price !== null && cost !== null ? unitMargin(price, cost) : null;
  const perCarton = v.byCarton && v.unitsPerCarton && WHOLE.test(v.unitsPerCarton) && Number(v.unitsPerCarton) > 0 ? Number(v.unitsPerCarton) : null;
  const looseCarton = price !== null && perCarton !== null ? price * perCarton : null;
  const opening = v.openingStock && WHOLE.test(v.openingStock) ? Number(v.openingStock) : null;

  const onSubmit = handleSubmit(async (values) => {
    setProblem(null);
    try {
      const saved = await onSave(values);
      if (saved) reset(saved);
    } catch (e) {
      if (e instanceof ApiError && e.code === "conflict") setError("sku", { message: e.message }, { shouldFocus: true });
      else setProblem(errorMessage(e));
    }
  });

  const noCategories = categories.length === 0;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <Card as="section">
        <h2 className="text-title tracking-normal">Product</h2>
        <div className="mt-5 grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-2">
          <div className="md:col-span-2">
            <Input label="Name" autoComplete="off" error={err.name?.message} {...register("name")} />
          </div>
          <Input label="SKU" autoComplete="off" hint="Your stock code. It must be unique." error={err.sku?.message} {...register("sku")} />
          <Select label="Category" error={err.categoryId?.message} hint={noCategories ? "Add a category first." : undefined} {...register("categoryId")}>
            <option value="">Choose a category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Input label="Unit" autoComplete="off" hint="What stock is counted in, like packet, bottle or bar." error={err.unitName?.message} {...register("unitName")} />
          <p className="flex items-center text-sm md:pb-7">
            <Link href="/app/manager/products/categories" className="text-link">
              Manage categories
            </Link>
          </p>
        </div>
      </Card>

      <Card as="section">
        <h2 className="text-title tracking-normal">Prices</h2>
        <div className="mt-5 grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-2">
          <Input label={`Price per ${unit} (Rs)`} inputMode="decimal" autoComplete="off" error={err.price?.message} {...register("price")} />
          {showCost ? (
            <Input
              label={`Cost per ${unit} (Rs)`}
              inputMode="decimal"
              autoComplete="off"
              hint={margin ? undefined : "What you pay for it. Only the owner and managers see this."}
              error={err.cost?.message}
              {...register("cost")}
            />
          ) : null}
        </div>
        {showCost && margin ? (
          <p className="mb-4 text-sm text-ink-2" aria-live="polite">
            Margin per {unit}: <MoneyText paisa={margin.paisa} />
            {margin.percent !== null ? ` (${margin.percent}% of the price)` : null}
            {margin.paisa < 0 ? <span className="font-medium text-error"> Below cost.</span> : null}
          </p>
        ) : null}
        <div className="border-t border-rule-2 pt-5">
          <Checkbox label="Also sold by the carton" {...register("byCarton")} />
          {v.byCarton ? (
            <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-2">
              <Input label={`${units[0].toUpperCase()}${units.slice(1)} per carton`} inputMode="numeric" autoComplete="off" error={err.unitsPerCarton?.message} {...register("unitsPerCarton")} />
              <Input
                label="Carton price (Rs)"
                inputMode="decimal"
                autoComplete="off"
                hint={looseCarton !== null ? `Loose, a carton's worth costs Rs ${formatAmount(looseCarton)}.` : undefined}
                error={err.cartonPrice?.message}
                {...register("cartonPrice")}
              />
            </div>
          ) : null}
        </div>
      </Card>

      <Card as="section">
        <h2 className="text-title tracking-normal">Stock</h2>
        <div className="mt-5 grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-2">
          {mode === "create" ? (
            <Input
              label={`Opening stock (${units})`}
              inputMode="numeric"
              autoComplete="off"
              hint={opening !== null ? (cartonEquivalent(opening, perCarton, unit) ? `= ${cartonEquivalent(opening, perCarton, unit)}` : countUnits(opening, unit)) : "What is in the warehouse now."}
              error={err.openingStock?.message}
              {...register("openingStock")}
            />
          ) : null}
          <Input label={`Low-stock level (${units})`} inputMode="numeric" autoComplete="off" hint="Flagged as low stock at or below this." error={err.lowStock?.message} {...register("lowStock")} />
        </div>
      </Card>

      <div>
        <FormProblem message={problem} />
        <div className="mt-2 flex flex-wrap gap-3">
          <Button type="submit" loading={formState.isSubmitting} loadingLabel="Saving…" disabled={mode === "edit" && !formState.isDirty}>
            {submitLabel}
          </Button>
          {mode === "edit" && formState.isDirty ? (
            <Button variant="quiet" onClick={() => reset()}>
              Undo changes
            </Button>
          ) : null}
          {footer}
        </div>
      </div>
    </form>
  );
}
