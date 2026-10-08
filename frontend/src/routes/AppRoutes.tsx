import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { ProtectedRoute } from './ProtectedRoute';

// Auth
import { LoginPage } from '../features/auth/LoginPage';
import { PlatformLoginPage } from '../features/auth/PlatformLoginPage';
import { RegisterPage } from '../features/auth/RegisterPage';

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

// Admin
import { AdminDashboardPage } from '../features/admin/AdminDashboardPage';
import { AdminApprovalsPage } from '../features/admin/AdminApprovalsPage';
import { AdminBusinessesPage } from '../features/admin/AdminBusinessesPage';
import { AdminCategoriesPage } from '../features/admin/AdminCategoriesPage';
import { AdminShipmentsPage } from '../features/admin/AdminShipmentsPage';
import { AdminOrdersPage } from '../features/admin/AdminOrdersPage';

import { useAuth } from '../lib/auth';

const IndexRedirect: React.FC = () => {
  const { isAuthenticated, activeOrg, isPlatformStaff } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (isPlatformStaff) return <Navigate to="/admin/dashboard" replace />;
  if (activeOrg?.canSell) return <Navigate to="/seller/dashboard" replace />;
  return <Navigate to="/browse" replace />;
};

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Public Auth Routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/platform/login" element={<PlatformLoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/payment/mock/:paymentId" element={<MockPaymentPage />} />

      {/* Authenticated Routes wrapped in Layout */}
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
            <ProtectedRoute requireSeller>
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
            <ProtectedRoute requireSeller>
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
