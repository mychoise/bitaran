import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { ProtectedRoute } from './ProtectedRoute';

// Auth
import { LoginPage } from '../features/auth/LoginPage';
import { PlatformLoginPage } from '../features/auth/PlatformLoginPage';
import { RegisterPage } from '../features/auth/RegisterPage';
import { ChangePasswordPage } from '../features/auth/ChangePasswordPage';

// Field Seller
import { FieldLoginPage } from '../features/field/FieldLoginPage';
import { FieldChangePasswordPage } from '../features/field/FieldChangePasswordPage';
import { FieldLayout } from '../features/field/FieldLayout';
import { FieldHomePage } from '../features/field/FieldHomePage';
import { FieldNewSalePage } from '../features/field/FieldNewSalePage';
import { FieldSalesPage } from '../features/field/FieldSalesPage';

// Buyer
import { BrowsePage } from '../features/buyer/BrowsePage';
import { ProductDetailPage } from '../features/buyer/ProductDetailPage';
import { CartPage } from '../features/buyer/CartPage';
import { MyOrdersPage } from '../features/buyer/MyOrdersPage';
import { OrderDetailPage } from '../features/buyer/OrderDetailPage';
import { AddressesPage } from '../features/buyer/AddressesPage';
import { MockPaymentPage } from '../features/buyer/MockPaymentPage';

// Seller
import { SellerDashboardPage } from '../features/seller/SellerDashboardPage';
import { SellerProductsPage } from '../features/seller/SellerProductsPage';
import { ProductFormPage } from '../features/seller/ProductFormPage';
import { SellerStockPage } from '../features/seller/SellerStockPage';
import { IncomingOrdersPage } from '../features/seller/IncomingOrdersPage';
import { FieldSellersListPage } from '../features/seller/FieldSellersListPage';
import { AddFieldSellerPage } from '../features/seller/AddFieldSellerPage';
import { FieldSellerDetailPage } from '../features/seller/FieldSellerDetailPage';
import { FieldAnalyticsPage } from '../features/seller/FieldAnalyticsPage';
import { TeamPage } from '../features/seller/TeamPage';
import { AddTeamMemberPage } from '../features/seller/AddTeamMemberPage';
import { ActivityPage } from '../features/seller/ActivityPage';

// Admin
import { AdminDashboardPage } from '../features/admin/AdminDashboardPage';
import { AdminApprovalsPage } from '../features/admin/AdminApprovalsPage';
import { AdminBusinessesPage } from '../features/admin/AdminBusinessesPage';
import { AdminCategoriesPage } from '../features/admin/AdminCategoriesPage';
import { AdminShipmentsPage } from '../features/admin/AdminShipmentsPage';
import { AdminOrdersPage } from '../features/admin/AdminOrdersPage';

import { useAuth } from '../lib/auth';

const IndexRedirect: React.FC = () => {
  const { isAuthenticated, activeOrg, isPlatformStaff, isFieldSeller } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (isFieldSeller) return <Navigate to="/field/home" replace />;
  if (isPlatformStaff) return <Navigate to="/admin/dashboard" replace />;
  if (activeOrg?.canSell) {
    if (activeOrg.roleName === 'OWNER' || activeOrg.permissions?.includes('report.view')) {
      return <Navigate to="/seller/dashboard" replace />;
    }
    return <Navigate to="/seller/products" replace />;
  }
  return <Navigate to="/browse" replace />;
};

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Public Auth Routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/field/login" element={<FieldLoginPage />} />
      <Route path="/platform/login" element={<PlatformLoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/payment/mock/:paymentId" element={<MockPaymentPage />} />

      {/* Field Seller Password Change (Outside Main Layout) */}
      <Route
        path="/field/password"
        element={
          <ProtectedRoute requireFieldSeller>
            <FieldChangePasswordPage />
          </ProtectedRoute>
        }
      />

      {/* Desktop User Password Change (Outside Main Layout) */}
      <Route
        path="/change-password"
        element={
          <ProtectedRoute>
            <ChangePasswordPage />
          </ProtectedRoute>
        }
      />

      {/* Field Seller Mobile App Routes (Wrapped in mobile FieldLayout) */}
      <Route
        path="/field"
        element={
          <ProtectedRoute requireFieldSeller>
            <FieldLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/field/home" replace />} />
        <Route path="home" element={<FieldHomePage />} />
        <Route path="sales/new" element={<FieldNewSalePage />} />
        <Route path="sales" element={<FieldSalesPage />} />
      </Route>

      {/* Authenticated Desktop Routes wrapped in Layout */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<IndexRedirect />} />

        {/* Buyer Routes */}
        <Route
          path="browse"
          element={
            <ProtectedRoute requireBuyer>
              <BrowsePage />
            </ProtectedRoute>
          }
        />
        <Route path="products/:id" element={<ProductDetailPage />} />
        <Route
          path="cart"
          element={
            <ProtectedRoute requireBuyer>
              <CartPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="orders"
          element={
            <ProtectedRoute requireBuyer>
              <MyOrdersPage />
            </ProtectedRoute>
          }
        />
        <Route path="orders/:id" element={<OrderDetailPage />} />
        <Route
          path="addresses"
          element={
            <ProtectedRoute requireBuyer>
              <AddressesPage />
            </ProtectedRoute>
          }
        />

        {/* Seller Routes */}
        <Route
          path="seller/dashboard"
          element={
            <ProtectedRoute requireSeller requiredPermission="report.view">
              <SellerDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="seller/products"
          element={
            <ProtectedRoute requireSeller>
              <SellerProductsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="seller/products/new"
          element={
            <ProtectedRoute requireSeller requiredPermission="product.create">
              <ProductFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="seller/products/:id/edit"
          element={
            <ProtectedRoute requireSeller>
              <ProductFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="seller/stock"
          element={
            <ProtectedRoute requireSeller>
              <SellerStockPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="seller/orders"
          element={
            <ProtectedRoute requireSeller>
              <IncomingOrdersPage />
            </ProtectedRoute>
          }
        />

        {/* Seller Field Routes */}
        <Route
          path="seller/field-sellers"
          element={
            <ProtectedRoute requireSeller requiredPermission="fieldseller.manage">
              <FieldSellersListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="seller/field-sellers/new"
          element={
            <ProtectedRoute requireSeller requiredPermission="fieldseller.manage">
              <AddFieldSellerPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="seller/field-sellers/:id"
          element={
            <ProtectedRoute requireSeller requiredPermission="fieldseller.manage">
              <FieldSellerDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="seller/field-analytics"
          element={
            <ProtectedRoute requireSeller requiredPermission="fieldanalytics.view">
              <FieldAnalyticsPage />
            </ProtectedRoute>
          }
        />

        {/* Seller Team & Activity Routes */}
        <Route
          path="seller/team"
          element={
            <ProtectedRoute requireSeller requiredPermission="team.manage_staff">
              <TeamPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="seller/team/new"
          element={
            <ProtectedRoute requireSeller requiredPermission="team.manage_staff">
              <AddTeamMemberPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="seller/activity"
          element={
            <ProtectedRoute requireSeller requiredPermission="audit.view">
              <ActivityPage />
            </ProtectedRoute>
          }
        />

        {/* Platform Admin Routes */}
        <Route
          path="admin/dashboard"
          element={
            <ProtectedRoute requireAdmin>
              <AdminDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/approvals"
          element={
            <ProtectedRoute requireAdmin>
              <AdminApprovalsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/businesses"
          element={
            <ProtectedRoute requireAdmin>
              <AdminBusinessesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/categories"
          element={
            <ProtectedRoute requireAdmin>
              <AdminCategoriesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/shipments"
          element={
            <ProtectedRoute requireAdmin>
              <AdminShipmentsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/orders"
          element={
            <ProtectedRoute requireAdmin>
              <AdminOrdersPage />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
