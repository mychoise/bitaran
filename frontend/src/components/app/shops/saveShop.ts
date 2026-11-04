import type { ApiClient, ShopCreateInput } from "@/lib/api/client";
import type { ImageChange } from "@/components/ui/ImagePicker";

/** Uploads a new PAN card photo first, then creates or updates the shop with it. */
export async function saveShop(api: ApiClient, input: ShopCreateInput, panPhoto: ImageChange, id?: string) {
  let panImageId: string | null | undefined;
  if (panPhoto.kind === "new") panImageId = (await api.uploads.image(panPhoto.blob)).id;
  if (panPhoto.kind === "remove") panImageId = null;
  const withPhoto = panImageId === undefined ? input : { ...input, panImageId };
  return id ? api.shops.update(id, withPhoto) : api.shops.create(withPhoto);
}

/** Every change to a shop refreshes shop lists, routes and the dashboard. */
export const SHOP_AFFECTS = [["shops"], ["routes"], ["reports"]];
