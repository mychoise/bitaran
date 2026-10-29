import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { APP_NAME } from '../config/app.config';
import { useAuth } from '../lib/auth';
import { ShoppingCart, Search, User, LogOut, ChevronDown, Menu } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

interface TopbarProps {
  onMenuClick: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({ onMenuClick }) => {
  const { user, memberships, activeOrg, switchOrg, logout, isPlatformStaff } = useAuth();
  const navigate = useNavigate();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close the profile menu on outside click or Escape
  useEffect(() => {
    if (!showProfileMenu) return;
    const onPointerDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowProfileMenu(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [showProfileMenu]);

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

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const value = (e.target as HTMLInputElement).value.trim();
      navigate(value ? `/browse?search=${encodeURIComponent(value)}` : '/browse');
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
      <div className="h-16 px-4 sm:px-6 flex items-center justify-between gap-3">
        {/* Left: menu, logo & search */}
        <div className="flex items-center gap-3 sm:gap-6 min-w-0">
          <button
            onClick={onMenuClick}
            aria-label="Open menu"
            className="lg:hidden p-2 -ml-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
          >
            <Menu className="w-5 h-5" />
          </button>

          <Link to="/" className="text-xl font-bold tracking-tight text-gray-900 hover:text-indigo-700">
            {APP_NAME}
          </Link>

          {activeOrg?.canBuy && (
            <div className="relative w-72 hidden md:block">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                aria-label="Search products"
                placeholder="Search products, brands…"
                className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                onKeyDown={handleSearch}
              />
            </div>
          )}
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-1 sm:gap-3 shrink-0">
          {isPlatformStaff && (
            <span className="hidden sm:inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-indigo-600 text-white tracking-wide">
              Platform staff
            </span>
          )}

          {/* Business Switcher for Sellers / Multi-org users */}
          {memberships.length > 1 && (
            <select
              aria-label="Switch business"
              value={activeOrg?.orgId}
              onChange={(e) => switchOrg(e.target.value)}
              className="max-w-[9rem] sm:max-w-[16rem] text-sm font-medium bg-gray-50 border border-gray-200 rounded-lg px-2 sm:px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {memberships.map((m) => (
                <option key={m.orgId} value={m.orgId}>
                  {m.orgName} ({m.roleName})
                </option>
              ))}
            </select>
          )}

          {/* Cart with count badge */}
          {activeOrg?.canBuy && (
            <button
              onClick={() => navigate('/cart')}
              aria-label={`Cart, ${cartItemCount} item${cartItemCount === 1 ? '' : 's'}`}
              className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
            >
              <ShoppingCart className="w-5 h-5" />
              {cartItemCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-indigo-600 text-white text-[11px] font-semibold leading-none">
                  {cartItemCount > 99 ? '99+' : cartItemCount}
                </span>
              )}
            </button>
          )}

          {/* Profile Avatar & Menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              aria-haspopup="menu"
              aria-expanded={showProfileMenu}
              className="flex items-center gap-1.5 p-1.5 rounded-lg hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-semibold text-sm">
                {user?.name?.[0]?.toUpperCase() ?? <User className="w-4 h-4" />}
              </div>
              <ChevronDown className="w-4 h-4 text-gray-500" />
            </button>

            {showProfileMenu && (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-60 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-50"
              >
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
                  role="menuitem"
                  onClick={handleLogout}
                  className="w-full px-4 py-2.5 text-left text-sm text-rose-600 hover:bg-rose-50 flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile search row */}
      {activeOrg?.canBuy && (
        <div className="md:hidden px-4 pb-3">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              aria-label="Search products"
              placeholder="Search products, brands…"
              className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
              onKeyDown={handleSearch}
            />
          </div>
        </div>
      )}
    </header>
  );
};
