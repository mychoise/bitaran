import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { APP_NAME } from '../config/app.config';
import { useAuth } from '../lib/auth';
import { ShoppingCart, Bell, Search, User, LogOut, ChevronDown } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export const Topbar: React.FC = () => {
  const { user, memberships, activeOrg, switchOrg, logout, isPlatformStaff } = useAuth();
  const navigate = useNavigate();
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // Cart count query (only if active org can buy)
  const { data: cartData } = useQuery({
    queryKey: ['cart', activeOrg?.orgId],
    queryFn: () => api.get<{ groups: Array<{ items: unknown[] }> }>('/cart'),
    enabled: !!activeOrg?.canBuy,
    refetchInterval: 10000,
  });

  const cartItemCount =
    cartData?.groups?.reduce((sum, g) => sum + (g.items?.length || 0), 0) ?? 0;

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Left: Logo & Search */}
      <div className="flex items-center space-x-8">
        <Link to="/" className="text-xl font-bold tracking-tight text-gray-900 hover:text-gray-700">
          {APP_NAME}
        </Link>

        {activeOrg?.canBuy && (
          <div className="relative w-72">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search products, brands..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:bg-white transition"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const target = e.target as HTMLInputElement;
                  navigate(`/browse?search=${encodeURIComponent(target.value)}`);
                }
              }}
            />
          </div>
        )}
      </div>

      {/* Right controls */}
      <div className="flex items-center space-x-4">
        {/* Admin Staff Badge */}
        {isPlatformStaff && (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-900 text-white tracking-wide">
            Platform staff
          </span>
        )}

        {/* Business Switcher for Sellers / Multi-org users */}
        {memberships.length > 1 && (
          <div className="flex items-center space-x-2">
            <label htmlFor="business-select" className="text-xs text-gray-500 font-medium">
              Business:
            </label>
            <select
              id="business-select"
              value={activeOrg?.orgId}
              onChange={(e) => switchOrg(e.target.value)}
              className="text-sm font-medium bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-900"
            >
              {memberships.map((m) => (
                <option key={m.orgId} value={m.orgId}>
                  {m.orgName} ({m.roleName})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Buyer Controls */}
        {activeOrg?.canBuy && (
          <>
            <button
              onClick={() => navigate('/cart')}
              className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition relative"
            >
              <ShoppingCart className="w-5 h-5" />
              <span>Cart ({cartItemCount})</span>
            </button>

            <button
              title="Alerts"
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
            >
              <Bell className="w-5 h-5" />
            </button>
          </>
        )}

        {/* Profile Avatar & Menu */}
        <div className="relative">
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center space-x-2 p-1.5 rounded-lg hover:bg-gray-100 transition focus:outline-none"
          >
            <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center font-semibold text-sm">
              {user?.name?.[0]?.toUpperCase() ?? <User className="w-4 h-4" />}
            </div>
            <ChevronDown className="w-4 h-4 text-gray-500" />
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-50">
              <div className="px-4 py-2.5 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-900 truncate">{user?.name}</p>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                {activeOrg && (
                  <p className="text-xs text-indigo-600 font-medium mt-1 truncate">
                    {activeOrg.orgName}
                  </p>
                )}
              </div>

              <button
                onClick={handleLogout}
                className="w-full px-4 py-2 text-left text-sm text-rose-600 hover:bg-rose-50 flex items-center space-x-2 transition"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
