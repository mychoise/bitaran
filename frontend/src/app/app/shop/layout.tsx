import { AreaLayout } from "@/components/app/AreaLayout";

export default function ShopLayout({ children }: LayoutProps<"/app/shop">) {
  return <AreaLayout area="/app/shop">{children}</AreaLayout>;
}
