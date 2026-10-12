import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Home, PlusCircle, Receipt, LogOut } from 'lucide-react';
import { APP_NAME } from '../../config/app.config';
import { useAuth } from '../../lib/auth';

export const FieldLayout: React.FC = () => {
  const { user, activeOrg, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/field/login');
  };

  // Mobile bottom tab styling
  const mobileNavTabClass = ({ isActive }: { isActive: boolean }) =>
    `flex flex-col items-center justify-center flex-1 h-full min-h-[48px] py-1 transition text-xs font-medium ${
      isActive ? 'text-blue-600 font-bold' : 'text-gray-500 hover:text-gray-900'
    }`;

  // Desktop top navbar link styling
  const desktopNavTabClass = ({ isActive }: { isActive: boolean }) =>
    `inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-colors ${
      isActive
        ? 'bg-blue-50 text-blue-700 font-semibold shadow-2xs'
        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
    }`;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-between">
      {/* Top Header (Mobile & Desktop Responsive) */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          {/* Left: Brand & Employer Company */}
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white font-bold flex items-center justify-center text-lg shrink-0 shadow-xs">
              {activeOrg?.orgName ? activeOrg.orgName.charAt(0) : APP_NAME.charAt(0)}
            </div>
            <div className="min-w-0">
              <span className="font-bold text-gray-900 tracking-tight text-base sm:text-lg leading-tight block truncate">
                {activeOrg?.orgName || APP_NAME}
              </span>
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <span className="font-medium text-blue-600">Field Sales Portal</span>
                <span>•</span>
                <span>{APP_NAME}</span>
              </div>
            </div>
          </div>

          {/* Center: Desktop Navigation Tabs (Hidden on mobile) */}
          <nav className="hidden md:flex items-center space-x-2">
            <NavLink to="/field/home" className={desktopNavTabClass}>
              <Home className="w-4 h-4" />
              <span>Dashboard</span>
            </NavLink>
            <NavLink to="/field/sales/new" className={desktopNavTabClass}>
              <PlusCircle className="w-4 h-4" />
              <span>Record Sale</span>
            </NavLink>
            <NavLink to="/field/sales" className={desktopNavTabClass}>
              <Receipt className="w-4 h-4" />
              <span>Sales History</span>
            </NavLink>
          </nav>

          {/* Right: Seller Profile & Logout */}
          <div className="flex items-center space-x-3 shrink-0">
            <div className="hidden sm:block text-right">
              <span className="text-sm text-gray-900 font-semibold block leading-tight">
                {user?.name || user?.username}
              </span>
              <span className="text-xs text-gray-400 font-mono block leading-tight">
                @{user?.username}
              </span>
            </div>

            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium text-gray-600 hover:text-rose-600 hover:bg-rose-50 transition rounded-xl border border-gray-200 hover:border-rose-200 cursor-pointer"
              title="Sign out of field portal"
              aria-label="Sign out"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area: Responsive max-w-7xl with comfortable desktop padding */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-12">
        <Outlet />
      </main>

      {/* Mobile-Only Bottom Navigation Bar (hidden on md and larger screens) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 shadow-lg">
        <div className="max-w-md mx-auto flex items-center justify-around h-16">
          <NavLink to="/field/home" className={mobileNavTabClass}>
            <Home className="w-5 h-5 mb-1" />
            <span>Home</span>
          </NavLink>
          <NavLink to="/field/sales/new" className={mobileNavTabClass}>
            <PlusCircle className="w-5 h-5 mb-1" />
            <span>New sale</span>
          </NavLink>
          <NavLink to="/field/sales" className={mobileNavTabClass}>
            <Receipt className="w-5 h-5 mb-1" />
            <span>My sales</span>
          </NavLink>
        </div>
      </nav>
    </div>
  );
};
