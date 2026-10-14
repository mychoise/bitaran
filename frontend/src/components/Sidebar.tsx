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
  Users,
  BarChart3,
  UserCog,
  History,
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { activeOrg, isPlatformStaff } = useAuth();

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
      isActive
        ? 'bg-gray-900 text-white shadow-sm'
        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
    }`;

  return (
    <aside className="w-[200px] flex-shrink-0 bg-white border-r border-gray-200 min-h-[calc(100vh-64px)] p-3 flex flex-col space-y-6">
      {/* Platform Admin Menu */}
      {isPlatformStaff && (
        <div>
          <div className="px-3 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Admin
          </div>
          <nav className="space-y-1">
            <NavLink to="/admin/dashboard" className={navClass}>
              <LayoutDashboard className="w-4 h-4" />
              <span>Dashboard</span>
            </NavLink>
            <NavLink to="/admin/approvals" className={navClass}>
              <ShieldCheck className="w-4 h-4" />
              <span>Approvals</span>
            </NavLink>
            <NavLink to="/admin/businesses" className={navClass}>
              <Building2 className="w-4 h-4" />
              <span>Businesses</span>
            </NavLink>
            <NavLink to="/admin/categories" className={navClass}>
              <FolderTree className="w-4 h-4" />
              <span>Categories</span>
            </NavLink>
            <NavLink to="/admin/shipments" className={navClass}>
              <Truck className="w-4 h-4" />
              <span>Shipments</span>
            </NavLink>
            <NavLink to="/admin/orders" className={navClass}>
              <ClipboardList className="w-4 h-4" />
              <span>Orders</span>
            </NavLink>
          </nav>
        </div>
      )}

      {/* Buyer Menu */}
      {activeOrg?.canBuy && !isPlatformStaff && (
        <div>
          <div className="px-3 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Buyer
          </div>
          <nav className="space-y-1">
            <NavLink to="/browse" className={navClass}>
              <Store className="w-4 h-4" />
              <span>Browse</span>
            </NavLink>
            <NavLink to="/cart" className={navClass}>
              <ShoppingCart className="w-4 h-4" />
              <span>Cart</span>
            </NavLink>
            <NavLink to="/orders" className={navClass}>
              <Package className="w-4 h-4" />
              <span>My orders</span>
            </NavLink>
            <NavLink to="/addresses" className={navClass}>
              <MapPin className="w-4 h-4" />
              <span>Addresses</span>
            </NavLink>
          </nav>
        </div>
      )}

      {/* Seller Menu */}
      {activeOrg?.canSell && !isPlatformStaff && (
        <div>
          <div className="px-3 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Seller
          </div>
          <nav className="space-y-1">
            {(activeOrg?.roleName === 'OWNER' || activeOrg?.permissions?.includes('report.view')) && (
              <NavLink to="/seller/dashboard" className={navClass}>
                <LayoutDashboard className="w-4 h-4" />
                <span>Dashboard</span>
              </NavLink>
            )}
            <NavLink to="/seller/products" className={navClass}>
              <Boxes className="w-4 h-4" />
              <span>Products</span>
            </NavLink>
            <NavLink to="/seller/stock" className={navClass}>
              <Layers className="w-4 h-4" />
              <span>Stock</span>
            </NavLink>
            <NavLink to="/seller/orders" className={navClass}>
              <Inbox className="w-4 h-4" />
              <span>Incoming orders</span>
            </NavLink>
            {(activeOrg?.roleName === 'OWNER' || activeOrg?.permissions?.includes('fieldseller.manage')) && (
              <NavLink to="/seller/field-sellers" className={navClass}>
                <Users className="w-4 h-4" />
                <span>Field sellers</span>
              </NavLink>
            )}
            {(activeOrg?.roleName === 'OWNER' || activeOrg?.permissions?.includes('fieldanalytics.view')) && (
              <NavLink to="/seller/field-analytics" className={navClass}>
                <BarChart3 className="w-4 h-4" />
                <span>Field analytics</span>
              </NavLink>
            )}
            {(activeOrg?.roleName === 'OWNER' ||
              activeOrg?.permissions?.includes('team.manage_staff') ||
              activeOrg?.permissions?.includes('team.manage_managers')) && (
              <NavLink to="/seller/team" className={navClass}>
                <UserCog className="w-4 h-4" />
                <span>Team</span>
              </NavLink>
            )}
            {(activeOrg?.roleName === 'OWNER' || activeOrg?.permissions?.includes('audit.view')) && (
              <NavLink to="/seller/activity" className={navClass}>
                <History className="w-4 h-4" />
                <span>Activity</span>
              </NavLink>
            )}
          </nav>
        </div>
      )}

      {/* Pending status banner if org is pending */}
      {activeOrg && activeOrg.orgStatus === 'PENDING' && !isPlatformStaff && (
        <div className="mt-auto p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
          <p className="font-semibold">Review Pending</p>
          <p className="mt-1 text-amber-700">
            Platform admins review new accounts before products or orders can be activated.
          </p>
        </div>
      )}
    </aside>
  );
};
