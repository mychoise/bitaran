import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: string;
  requireAdmin?: boolean;
  requireBuyer?: boolean;
  requireSeller?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredPermission,
  requireAdmin,
  requireBuyer,
  requireSeller,
}) => {
  const { isAuthenticated, activeOrg, isPlatformStaff } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    if (location.pathname.startsWith('/admin')) {
      return <Navigate to="/platform/login" state={{ from: location }} replace />;
    }
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Admin route check
  if (requireAdmin && !isPlatformStaff) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl border border-gray-200 text-center max-w-md shadow-xs">
          <h1 className="text-2xl font-bold text-gray-900">403 Forbidden</h1>
          <p className="mt-2 text-sm text-gray-600">
            You do not have administrative permissions to access this platform page.
          </p>
        </div>
      </div>
    );
  }

  // Buyer check
  if (requireBuyer && !activeOrg?.canBuy) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl border border-gray-200 text-center max-w-md shadow-xs">
          <h1 className="text-2xl font-bold text-gray-900">403 Forbidden</h1>
          <p className="mt-2 text-sm text-gray-600">
            Your active organization is not registered as a buyer (dealer).
          </p>
        </div>
      </div>
    );
  }

  // Seller check
  if (requireSeller && !activeOrg?.canSell) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl border border-gray-200 text-center max-w-md shadow-xs">
          <h1 className="text-2xl font-bold text-gray-900">403 Forbidden</h1>
          <p className="mt-2 text-sm text-gray-600">
            Your active organization is not registered as a seller (wholesaler).
          </p>
        </div>
      </div>
    );
  }

  // Permission check
  if (requiredPermission && !activeOrg?.permissions?.includes(requiredPermission)) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl border border-gray-200 text-center max-w-md shadow-xs">
          <h1 className="text-2xl font-bold text-gray-900">403 Forbidden</h1>
          <p className="mt-2 text-sm text-gray-600">
            Missing required permission: <code>{requiredPermission}</code>
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
