import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: string;
  requireAdmin?: boolean;
  requireBuyer?: boolean;
  requireSeller?: boolean;
  requireFieldSeller?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredPermission,
  requireAdmin,
  requireBuyer,
  requireSeller,
  requireFieldSeller,
}) => {
  const { user, isAuthenticated, activeOrg, isPlatformStaff, isFieldSeller } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    if (location.pathname.startsWith('/field')) {
      return <Navigate to="/field/login" state={{ from: location }} replace />;
    }
    if (location.pathname.startsWith('/admin')) {
      return <Navigate to="/platform/login" state={{ from: location }} replace />;
    }
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Forced password change check
  if (user?.mustChangePassword) {
    if (isFieldSeller && location.pathname !== '/field/password') {
      return <Navigate to="/field/password" replace />;
    }
    if (!isFieldSeller && location.pathname !== '/change-password') {
      return <Navigate to="/change-password" replace />;
    }
  }

  // Field seller specific check
  if (requireFieldSeller && !isFieldSeller) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl border border-gray-200 text-center max-w-md shadow-xs">
          <h1 className="text-2xl font-bold text-gray-900">403 Forbidden</h1>
          <p className="mt-2 text-sm text-gray-600">
            You do not have field seller permissions.
          </p>
        </div>
      </div>
    );
  }

  // A field seller can never access buyer, seller or admin routes
  if (isFieldSeller && !location.pathname.startsWith('/field')) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl border border-gray-200 text-center max-w-md shadow-xs">
          <h1 className="text-2xl font-bold text-gray-900">403 Forbidden</h1>
          <p className="mt-2 text-sm text-gray-600">
            Field sellers cannot access buyer, seller, or admin routes.
          </p>
        </div>
      </div>
    );
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

  // Permission check (Owners inherently possess full business permissions)
  const isOwner = activeOrg?.roleName === 'OWNER';
  if (requiredPermission && !isOwner && !activeOrg?.permissions?.includes(requiredPermission)) {
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
