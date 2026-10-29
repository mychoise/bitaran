import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { notifyError } from '../../lib/notify';
import { formatMoney } from '../../lib/money';
import { StatusBadge } from '../../components/StatusBadge';
import { useAuth } from '../../lib/auth';
import { ExternalLink, Inbox, RefreshCw } from 'lucide-react';

export const IncomingOrdersPage: React.FC = () => {
  const { activeOrg } = useAuth();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('');

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['seller-orders', activeOrg?.orgId, statusFilter],
    queryFn: () =>
      api.get<any[]>('/orders/seller', {
        status: statusFilter || undefined,
      }),
    enabled: !!activeOrg?.canSell,
  });

  const transitionMutation = useMutation({
    mutationFn: ({ orderId, toStatus }: { orderId: string; toStatus: string }) =>
      api.post(`/orders/${orderId}/transition`, { toStatus }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seller-orders'] });
    },
    onError: (err: any) => {
      notifyError(err.message || 'Action failed');
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Incoming Orders</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage dealer orders placed with {activeOrg?.orgName}
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <label htmlFor="incoming-status-filter" className="text-sm text-gray-500 font-medium">
            Filter status:
          </label>
          <select
            id="incoming-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm bg-white border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All statuses</option>
            <option value="PAYMENT_PENDING">Payment pending</option>
            <option value="PAID">Paid (Needs review)</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="READY_FOR_PICKUP">Ready for pickup</option>
            <option value="IN_DELIVERY">In delivery</option>
            <option value="DELIVERED">Delivered</option>
            <option value="REJECTED_REFUND_PENDING">Rejected (Refund pending)</option>
            <option value="REFUNDED">Refunded</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading incoming orders...</div>
        ) : orders.length === 0 ? (
          <div className="p-12 text-center">
            <Inbox className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-gray-900">No incoming orders</h3>
            <p className="text-sm text-gray-500 mt-1">
              Orders placed by retail dealers will appear here for fulfilment.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3.5 text-left font-semibold text-gray-700">Order</th>
                  <th className="px-6 py-3.5 text-left font-semibold text-gray-700">Buyer</th>
                  <th className="px-6 py-3.5 text-right font-semibold text-gray-700">Total</th>
                  <th className="px-6 py-3.5 text-center font-semibold text-gray-700">Status</th>
                  <th className="px-6 py-3.5 text-right font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {orders.map((order: any) => (
                  <tr key={order.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 font-mono text-xs font-semibold text-gray-900">
                      #{order.id.slice(0, 8).toUpperCase()}
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {order.buyerName || 'Dealer Business'}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-gray-900">
                      {formatMoney(order.totalPaisa)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        {order.status === 'PAID' && (
                          <>
                            <button
                              onClick={() =>
                                transitionMutation.mutate({
                                  orderId: order.id,
                                  toStatus: 'CONFIRMED',
                                })
                              }
                              disabled={transitionMutation.isPending}
                              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold shadow-xs transition"
                              title="Accept this order"
                            >
                              Accept
                            </button>
                            <button
                              onClick={() =>
                                transitionMutation.mutate({
                                  orderId: order.id,
                                  toStatus: 'REJECTED_REFUND_PENDING',
                                })
                              }
                              disabled={transitionMutation.isPending}
                              className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-bold shadow-xs transition"
                              title="Reject and queue refund"
                            >
                              Reject
                            </button>
                          </>
                        )}

                        {order.status === 'REJECTED_REFUND_PENDING' && (
                          <button
                            onClick={() =>
                              transitionMutation.mutate({
                                orderId: order.id,
                                toStatus: 'REFUNDED',
                              })
                            }
                            disabled={transitionMutation.isPending}
                            className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold shadow-xs transition flex items-center space-x-1"
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>Mark refunded</span>
                          </button>
                        )}

                        <Link
                          to={`/orders/${order.id}`}
                          className="px-2.5 py-1.5 text-xs font-bold text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded inline-flex items-center space-x-1"
                        >
                          <span>View</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      </div>
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
