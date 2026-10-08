import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { formatMoney } from '../../lib/money';
import { StatusBadge } from '../../components/StatusBadge';
import { useAuth } from '../../lib/auth';
import {
  Inbox,
  AlertTriangle,
  Truck,
  CreditCard,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';

export const SellerDashboardPage: React.FC = () => {
  const { activeOrg } = useAuth();

  // Fetch incoming orders
  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['seller-orders', activeOrg?.orgId],
    queryFn: () => api.get<any[]>('/orders/seller'),
    enabled: !!activeOrg?.canSell,
  });

  // Fetch inventory
  const { data: stockItems = [] } = useQuery({
    queryKey: ['seller-stock', activeOrg?.orgId],
    queryFn: () => api.get<any[]>('/inventory/stock'),
    enabled: !!activeOrg?.canSell,
  });

  // Stats calculation
  const ordersToReview = orders.filter((o) => o.status === 'PAID').length;
  const ordersInDelivery = orders.filter(
    (o) => o.status === 'IN_DELIVERY' || o.status === 'READY_FOR_PICKUP',
  ).length;
  const lowStockItems = stockItems.filter(
    (i: any) => (i.qtyOnHand ?? 0) - (i.qtyReserved ?? 0) <= 10,
  ).length;

  const recentOrders = orders.slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Seller Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Overview of incoming dealer orders, inventory alerts, and shipments for {activeOrg?.orgName}
        </p>
      </div>

      {/* Four count tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Orders to review
            </p>
            <p className="text-2xl font-extrabold text-gray-900 mt-1">{ordersToReview}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <Inbox className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Low stock items
            </p>
            <p className="text-2xl font-extrabold text-gray-900 mt-1">{lowStockItems}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Orders in delivery
            </p>
            <p className="text-2xl font-extrabold text-gray-900 mt-1">{ordersInDelivery}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
            <Truck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Monthly fee status
            </p>
            <p className="text-sm font-bold text-emerald-600 mt-1.5">Active (Prototype)</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CreditCard className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Recent incoming orders table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">Recent incoming orders</h2>
          <Link
            to="/seller/orders"
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center space-x-1"
          >
            <span>View all</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {ordersLoading ? (
          <div className="p-8 text-center text-gray-400">Loading incoming orders...</div>
        ) : recentOrders.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            No incoming orders yet. Once dealers checkout your products, they will appear here.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700">Order</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700">Buyer</th>
                  <th className="px-6 py-3 text-right font-semibold text-gray-700">Total</th>
                  <th className="px-6 py-3 text-center font-semibold text-gray-700">Status</th>
                  <th className="px-6 py-3 text-right font-semibold text-gray-700">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {recentOrders.map((order: any) => (
                  <tr key={order.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-3.5 font-mono text-xs font-semibold text-gray-900">
                      #{order.id.slice(0, 8).toUpperCase()}
                    </td>
                    <td className="px-6 py-3.5 font-medium text-gray-900">
                      {order.buyerName || 'Dealer Business'}
                    </td>
                    <td className="px-6 py-3.5 text-right font-bold text-gray-900">
                      {formatMoney(order.totalPaisa)}
                    </td>
                    <td className="px-6 py-3.5 text-center">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <Link
                        to={`/orders/${order.id}`}
                        className="inline-flex items-center space-x-1 text-xs font-bold text-indigo-600 hover:text-indigo-800"
                      >
                        <span>View</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
