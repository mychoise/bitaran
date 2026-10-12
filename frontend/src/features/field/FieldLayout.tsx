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

  const navTabClass = ({ isActive }: { isActive: boolean }) =>
    `flex flex-col items-center justify-center flex-1 h-full min-h-[48px] py-1 transition text-xs font-medium ${
      isActive ? 'text-blue-600 font-bold' : 'text-gray-500 hover:text-gray-900'
    }`;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-between">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-2.5 flex items-center justify-between shadow-xs max-w-md mx-auto w-full">
        <div className="flex items-center space-x-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-blue-600 text-white font-bold flex items-center justify-center text-base shrink-0 shadow-xs">
            {activeOrg?.orgName ? activeOrg.orgName.charAt(0) : APP_NAME.charAt(0)}
          </div>
          <div className="min-w-0">
            <span className="font-bold text-gray-900 tracking-tight text-sm leading-tight block truncate">
              {activeOrg?.orgName || APP_NAME}
            </span>
            <span className="text-[11px] font-medium text-blue-600 block leading-tight truncate">
              Field Seller • {APP_NAME}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <div className="text-right">
            <span className="text-xs text-gray-800 font-semibold block truncate max-w-[100px]">
              {user?.name || user?.username}
            </span>
            <span className="text-[10px] text-gray-400 font-mono block">
              @{user?.username}
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-400 hover:text-rose-600 transition rounded-lg"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content Area (Single Column, Mobile-first max-w-md) */}
      <main className="flex-1 max-w-md mx-auto w-full p-4 pb-24">
        <Outlet />
      </main>

      {/* Fixed Bottom Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 shadow-lg">
        <div className="max-w-md mx-auto flex items-center justify-around h-16">
          <NavLink to="/field/home" className={navTabClass}>
            <Home className="w-6 h-6 mb-1" />
            <span>Home</span>
          </NavLink>
          <NavLink to="/field/sales/new" className={navTabClass}>
            <PlusCircle className="w-6 h-6 mb-1" />
            <span>New sale</span>
          </NavLink>
          <NavLink to="/field/sales" className={navTabClass}>
            <Receipt className="w-6 h-6 mb-1" />
            <span>My sales</span>
          </NavLink>
        </div>
      </nav>
    </div>
  );
};
