import { AreaLayout } from "@/components/app/AreaLayout";

export default function SalesmanLayout({ children }: LayoutProps<"/app/salesman">) {
  return <AreaLayout area="/app/salesman">{children}</AreaLayout>;
}
