"use client";

import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/Display";
import { BackLink } from "@/components/ui/Form";
import type { ImageChange } from "@/components/ui/ImagePicker";
import { useToast } from "@/components/ui/Overlay";
import type { ShopCreateInput } from "@/lib/api/client";
import { useApiMutation } from "@/lib/api/provider";
import { ShopForm } from "./ShopForm";
import { SHOP_AFFECTS, saveShop } from "./saveShop";

export function NewShop() {
  const router = useRouter();
  const toast = useToast();
  const create = useApiMutation((api, v: { input: ShopCreateInput; panPhoto: ImageChange }) => saveShop(api, v.input, v.panPhoto), SHOP_AFFECTS);
  return (
    <>
      <BackLink href="/app/manager/shops" label="Shops" />
      <PageHeader title="Add shop" lead="New shops start active. Put them on a route to have them visited." />
      <div className="max-w-5xl">
        <ShopForm
          mode="create"
          submitLabel="Add shop"
          onSave={async (input, panPhoto) => {
            const shop = await create.mutateAsync({ input, panPhoto });
            toast(input.loginEmail ? `${shop.name} added. Give the shop its temporary password in person.` : `${shop.name} added.`);
            router.push(`/app/manager/shops/${shop.id}`);
          }}
        />
      </div>
    </>
  );
}
