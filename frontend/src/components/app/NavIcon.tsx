import {
  BoxIcon,
  CameraIcon,
  CartIcon,
  ChartIcon,
  HomeIcon,
  MoreIcon,
  ReceiptIcon,
  ReturnIcon,
  RouteIcon,
  SettingsIcon,
  StoreIcon,
  UsersIcon,
  WalletIcon,
} from "@/components/ui/icons";

const ICONS = {
  home: HomeIcon,
  route: RouteIcon,
  receipt: ReceiptIcon,
  wallet: WalletIcon,
  store: StoreIcon,
  box: BoxIcon,
  return: ReturnIcon,
  camera: CameraIcon,
  chart: ChartIcon,
  users: UsersIcon,
  settings: SettingsIcon,
  cart: CartIcon,
  more: MoreIcon,
} as const;

export function NavIcon({ name, className = "size-5" }: { name: string; className?: string }) {
  const Icon = ICONS[name as keyof typeof ICONS] ?? HomeIcon;
  return <Icon className={`shrink-0 ${className}`} />;
}
