import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import {
  Store,
  ShoppingCart,
  Package,
  MapPin,
  LayoutDashboard,
  Boxes,
  Layers,
  Inbox,
  ShieldCheck,
  Building2,
  FolderTree,
  Truck,
  ClipboardList,
  X,
  type LucideIcon,
} from 'lucide-react';
import { APP_NAME } from '../config/app.config';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

const adminItems: NavItem[] = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/approvals', label: 'Approvals', icon: ShieldCheck },
  { to: '/admin/businesses', label: 'Businesses', icon: Building2 },
  { to: '/admin/categories', label: 'Categories', icon: FolderTree },
  { to: '/admin/shipments', label: 'Shipments', icon: Truck },
  { to: '/admin/orders', label: 'Orders', icon: ClipboardList },
];

const buyerItems: NavItem[] = [
  { to: '/browse', label: 'Browse', icon: Store },
  { to: '/cart', label: 'Cart', icon: ShoppingCart },
  { to: '/orders', label: 'My orders', icon: Package },
  { to: '/addresses', label: 'Addresses', icon: MapPin },
];

const sellerItems: NavItem[] = [
  { to: '/seller/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/seller/products', label: 'Products', icon: Boxes },
  { to: '/seller/stock', label: 'Stock', icon: Layers },
  { to: '/seller/orders', label: 'Incoming orders', icon: Inbox },
];

const navClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${
    isActive
      ? 'bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-100'
      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
  }`;

const NavGroup: React.FC<{ title: string; items: NavItem[] }> = ({ title, items }) => (
  <div>
    <div className="px-3 mb-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
      {title}
    </div>
    <nav className="space-y-1" aria-label={title}>
      {items.map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to} className={navClass}>
          <Icon className="w-[18px] h-[18px] shrink-0" aria-hidden="true" />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  </div>
);

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ open, onClose }) => {
  const { activeOrg, isPlatformStaff } = useAuth();

  return (
    <>
      {/* Backdrop for the mobile drawer */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-gray-900/40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`${
          open ? 'translate-x-0' : '-translate-x-full'
        } fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 p-4 flex flex-col gap-6 overflow-y-auto lg:static lg:z-auto lg:w-60 lg:translate-x-0 lg:flex-shrink-0 lg:min-h-[calc(100vh-64px)]`}
      >
        {/* Drawer header (mobile only) */}
        <div className="flex items-center justify-between lg:hidden">
          <span className="text-lg font-bold tracking-tight text-gray-900">{APP_NAME}</span>
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="p-2 -mr-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isPlatformStaff && <NavGroup title="Admin" items={adminItems} />}
        {activeOrg?.canBuy && !isPlatformStaff && <NavGroup title="Buyer" items={buyerItems} />}
        {activeOrg?.canSell && !isPlatformStaff && <NavGroup title="Seller" items={sellerItems} />}

        {/* Pending status banner if org is pending */}
        {activeOrg && activeOrg.orgStatus === 'PENDING' && !isPlatformStaff && (
          <div className="mt-auto p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
            <p className="font-semibold">Review pending</p>
            <p className="mt-1 text-amber-700">
              Platform admins review new accounts before products or orders can be activated.
            </p>
          </div>
        )}
      </aside>
    </>
  );
};
