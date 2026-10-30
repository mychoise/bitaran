"use client";

import { useRouter } from "next/navigation";
import { BackLink } from "@/components/ui/Form";
import { PageHeader } from "@/components/ui/Display";
import { useToast } from "@/components/ui/Overlay";
import type { ProductInput } from "@/lib/api/client";
import { useApiMutation } from "@/lib/api/provider";
import { ProductForm, toInput } from "./ProductForm";

export function NewProduct() {
  const router = useRouter();
  const toast = useToast();
  const create = useApiMutation((api, input: ProductInput) => api.products.create(input), [["products"], ["categories"], ["reports"]]);
  return (
    <>
      <BackLink href="/app/manager/products" label="Products and stock" />
      <PageHeader title="Add product" lead="New products start active. You can add a photo after saving." />
      <div className="max-w-4xl">
        <ProductForm
          mode="create"
          submitLabel="Add product"
          onSave={async (values) => {
            const product = await create.mutateAsync({ ...toInput(values), stockUnits: Number(values.openingStock), active: true });
            toast(`${product.name} added.`);
            router.push(`/app/manager/products/${product.id}`);
          }}
        />
      </div>
    </>
  );
}
