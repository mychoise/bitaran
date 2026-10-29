import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { notifyError } from '../../lib/notify';
import { formatMoney } from '../../lib/money';
import { StatusBadge } from '../../components/StatusBadge';
import { useAuth } from '../../lib/auth';
import {
  ArrowLeft,
  Truck,
  CheckCircle2,
  Circle,
  Check,
  X,
  RefreshCw,
} from 'lucide-react';

const ORDER_STEPS = [
  { key: 'PAYMENT_PENDING', label: 'Payment pending' },
  { key: 'PAID', label: 'Paid' },
  { key: 'CONFIRMED', label: 'Confirmed' },
  { key: 'READY_FOR_PICKUP', label: 'Ready for pickup' },
  { key: 'IN_DELIVERY', label: 'In delivery' },
  { key: 'DELIVERED', label: 'Delivered' },
];

export const OrderDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { activeOrg } = useAuth();
  const queryClient = useQueryClient();

  const { data: order, isLoading, error } = useQuery({
    queryKey: ['order', id],
    queryFn: () => api.get<any>(`/orders/${id}`),
    enabled: !!id,
  });

  const transitionMutation = useMutation({
    mutationFn: (toStatus: string) =>
      api.post(`/orders/${id}/transition`, { toStatus }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', id] });
    },
    onError: (err: any) => {
      notifyError(err.message || 'Transition failed');
    },
  });

  if (isLoading) {
    return <div className="p-8 text-center text-gray-400">Loading order details...</div>;
  }

  if (error || !order) {
    return (
      <div className="bg-white p-8 rounded-xl border border-gray-200 text-center">
        <h2 className="text-base font-bold text-gray-900">Order not found</h2>
        <Link to="/orders" className="mt-4 inline-block text-sm text-indigo-600 hover:underline">
          &larr; Return to orders
        </Link>
      </div>
    );
  }

  const isSeller = activeOrg?.orgId === order.sellerOrgId;
  const currentStepIndex = ORDER_STEPS.findIndex((s) => s.key === order.status);

  return (
    <div className="space-y-6">
      {/* Top Bar Navigation & Header */}
      <div>
        <Link
          to={isSeller ? '/seller/orders' : '/orders'}
          className="inline-flex items-center space-x-1.5 text-sm font-medium text-gray-500 hover:text-gray-900 mb-3 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to {isSeller ? 'incoming orders' : 'my orders'}</span>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-bold text-gray-900 font-mono">
              Order #{order.id.slice(0, 8).toUpperCase()}
            </h1>
            <StatusBadge status={order.status} />
          </div>

          {/* Seller Action Buttons */}
          {isSeller && (
            <div className="flex items-center space-x-3">
              {order.status === 'PAID' && (
                <>
                  <button
                    onClick={() => transitionMutation.mutate('CONFIRMED')}
                    disabled={transitionMutation.isPending}
                    className="inline-flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold shadow-sm transition"
                  >
                    <Check className="w-4 h-4" />
                    <span>Accept order</span>
                  </button>
                  <button
                    onClick={() => transitionMutation.mutate('REJECTED_REFUND_PENDING')}
                    disabled={transitionMutation.isPending}
                    className="inline-flex items-center space-x-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-bold shadow-sm transition"
                  >
                    <X className="w-4 h-4" />
                    <span>Reject order</span>
                  </button>
                </>
              )}

              {order.status === 'CONFIRMED' && (
                <button
                  onClick={() => transitionMutation.mutate('READY_FOR_PICKUP')}
                  disabled={transitionMutation.isPending}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold shadow-sm transition"
                >
                  <Truck className="w-4 h-4" />
                  <span>Mark Ready for Pickup</span>
                </button>
              )}

              {order.status === 'REJECTED_REFUND_PENDING' && (
                <button
                  onClick={() => transitionMutation.mutate('REFUNDED')}
                  disabled={transitionMutation.isPending}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold shadow-sm transition"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Mark refunded</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Items Table & Pricing */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <span className="text-sm font-bold text-gray-900">Order Items</span>
              <span className="text-xs text-gray-500">
                Seller: <strong className="text-gray-900">{order.sellerName || 'Wholesale Seller'}</strong>
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left font-semibold text-gray-700">Product</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-700">SKU</th>
                    <th className="px-6 py-3 text-right font-semibold text-gray-700">Unit Price</th>
                    <th className="px-6 py-3 text-center font-semibold text-gray-700">Qty</th>
                    <th className="px-6 py-3 text-right font-semibold text-gray-700">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {order.items?.map((item: any) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-semibold text-gray-900">{item.nameSnapshot}</td>
                      <td className="px-6 py-4 font-mono text-xs text-gray-500">{item.skuSnapshot}</td>
                      <td className="px-6 py-4 text-right font-medium text-gray-900">
                        {formatMoney(item.unitPricePaisa)}
                      </td>
                      <td className="px-6 py-4 text-center text-gray-700 font-medium">{item.qty}</td>
                      <td className="px-6 py-4 text-right font-bold text-gray-900">
                        {formatMoney(item.unitPricePaisa * item.qty)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals Breakdown */}
            <div className="p-6 bg-gray-50 border-t border-gray-100 space-y-2 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span className="font-semibold text-gray-900">{formatMoney(order.subtotalPaisa)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Delivery fee</span>
                <span className="font-semibold text-emerald-600">Rs 0.00</span>
              </div>
              <div className="flex justify-between text-base font-bold text-gray-900 pt-3 border-t border-gray-200">
                <span>Total amount</span>
                <span>{formatMoney(order.totalPaisa)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Vertical Status Timeline & Delivery Card */}
        <div className="space-y-6">
          {/* Vertical Timeline */}
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-5">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide border-b border-gray-100 pb-2">
              Order Status Progress
            </h2>

            <div className="space-y-4">
              {ORDER_STEPS.map((step, idx) => {
                const isCompleted = currentStepIndex > idx || order.status === 'DELIVERED';
                const isCurrent = order.status === step.key;

                return (
                  <div key={step.key} className="flex items-start space-x-3">
                    <div className="mt-0.5">
                      {isCompleted ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      ) : isCurrent ? (
                        <div className="w-5 h-5 rounded-full border-2 border-indigo-600 flex items-center justify-center">
                          <div className="w-2.5 h-2.5 bg-indigo-600 rounded-full" />
                        </div>
                      ) : (
                        <Circle className="w-5 h-5 text-gray-300" />
                      )}
                    </div>
                    <div>
                      <p
                        className={`text-sm ${
                          isCurrent
                            ? 'font-bold text-gray-900'
                            : isCompleted
                            ? 'font-medium text-gray-700'
                            : 'text-gray-400'
                        }`}
                      >
                        {step.label}
                      </p>
                    </div>
                  </div>
                );
              })}

              {/* Special States */}
              {order.status === 'REJECTED_REFUND_PENDING' && (
                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg font-medium">
                  Order was rejected by seller. Refund pending to buyer account.
                </div>
              )}
              {order.status === 'REFUNDED' && (
                <div className="p-3 bg-gray-100 border border-gray-200 text-gray-800 text-xs rounded-lg font-medium">
                  Order has been refunded.
                </div>
              )}
            </div>
          </div>

          {/* Delivery Card */}
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
            <div className="flex items-center space-x-2 border-b border-gray-100 pb-2">
              <Truck className="w-4 h-4 text-gray-500" />
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
                Delivery Details
              </h2>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="font-semibold text-gray-500 block">Courier / Logistics:</span>
                <span className="font-medium text-gray-900">
                  {order.shipment?.courierName || 'Platform Logistics Express'}
                </span>
              </div>

              <div>
                <span className="font-semibold text-gray-500 block">Tracking Reference:</span>
                <span className="font-mono font-medium text-gray-900">
                  {order.shipment?.trackingRef || 'Assigned on pickup'}
                </span>
              </div>

              <div className="pt-2 border-t border-gray-100">
                <span className="font-semibold text-gray-500 block">Pickup location (Seller):</span>
                <p className="text-gray-700">
                  {order.shipment?.pickupAddress?.line1 || 'Seller Warehouse'}, {order.shipment?.pickupAddress?.city || ''}
                </p>
              </div>

              <div>
                <span className="font-semibold text-gray-500 block">Drop location (Buyer):</span>
                <p className="text-gray-700">
                  {order.shipment?.dropAddress?.line1 || 'Buyer Delivery Location'}, {order.shipment?.dropAddress?.city || ''}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
