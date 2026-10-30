import { AreaLayout } from "@/components/app/AreaLayout";

export default function ManagerLayout({ children }: LayoutProps<"/app/manager">) {
  return <AreaLayout area="/app/manager">{children}</AreaLayout>;
}
