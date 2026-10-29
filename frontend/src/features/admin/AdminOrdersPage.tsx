import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { formatMoney } from '../../lib/money';
import { StatusBadge } from '../../components/StatusBadge';
import { ClipboardList } from 'lucide-react';

export const AdminOrdersPage: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState<string>('');

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['admin-all-orders', statusFilter],
    queryFn: () =>
      api.get<any[]>('/admin/orders', {
        status: statusFilter || undefined,
      }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">All Platform Orders</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Read-only audit ledger of every order placed across all wholesale sellers
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <label htmlFor="admin-order-status-filter" className="text-sm text-gray-500 font-medium">
            Filter status:
          </label>
          <select
            id="admin-order-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm bg-white border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All statuses</option>
            <option value="PAYMENT_PENDING">Payment pending</option>
            <option value="PAID">Paid</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="READY_FOR_PICKUP">Ready for pickup</option>
            <option value="IN_DELIVERY">In delivery</option>
            <option value="DELIVERED">Delivered</option>
            <option value="REJECTED_REFUND_PENDING">Rejected (Refund pending)</option>
            <option value="REFUNDED">Refunded</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading orders ledger...</div>
        ) : orders.length === 0 ? (
          <div className="p-12 text-center">
            <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-gray-900">No orders recorded</h3>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3.5 text-left font-semibold text-gray-700">Order</th>
                  <th className="px-6 py-3.5 text-left font-semibold text-gray-700">Buyer</th>
                  <th className="px-6 py-3.5 text-left font-semibold text-gray-700">Seller</th>
                  <th className="px-6 py-3.5 text-right font-semibold text-gray-700">Total</th>
                  <th className="px-6 py-3.5 text-center font-semibold text-gray-700">Status</th>
                  <th className="px-6 py-3.5 text-right font-semibold text-gray-700">Placed Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {orders.map((order: any) => (
                  <tr key={order.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 font-mono text-xs font-semibold text-gray-900">
                      #{order.id.slice(0, 8).toUpperCase()}
                    </td>
                    <td className="px-6 py-4 text-gray-900 font-medium">{order.buyerName}</td>
                    <td className="px-6 py-4 text-gray-900 font-medium">{order.sellerName}</td>
                    <td className="px-6 py-4 text-right font-bold text-gray-900">
                      {formatMoney(order.totalPaisa)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="px-6 py-4 text-right text-xs text-gray-500">
                      {new Date(order.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
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
