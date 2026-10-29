import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { notifyError } from '../../lib/notify';
import { Truck, Check } from 'lucide-react';

export const AdminShipmentsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [courierInputs, setCourierInputs] = useState<Record<string, string>>({});
  const [statusSelects, setStatusSelects] = useState<Record<string, string>>({});
  const [updatedId, setUpdatedId] = useState<string | null>(null);

  const { data: shipments = [], isLoading } = useQuery({
    queryKey: ['admin-shipments'],
    queryFn: () => api.get<any[]>('/shipments'),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      status,
      courierName,
      trackingRef,
    }: {
      id: string;
      status: string;
      courierName?: string;
      trackingRef?: string;
    }) =>
      api.put(`/shipments/${id}`, {
        status,
        courierName,
        trackingRef,
      }),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-shipments'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      setUpdatedId(id);
      setTimeout(() => setUpdatedId(null), 2000);
    },
    onError: (err: any) => {
      notifyError(err.message || 'Failed to update shipment');
    },
  });

  const handleUpdate = (shipment: any) => {
    const status = statusSelects[shipment.id] || shipment.status;
    const courierName = courierInputs[shipment.id] ?? (shipment.courierName || 'Platform Logistics');
    const trackingRef = shipment.trackingRef || `TRK-${shipment.id.slice(0, 6).toUpperCase()}`;

    updateMutation.mutate({
      id: shipment.id,
      status,
      courierName,
      trackingRef,
    });
  };

  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-gray-200">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Shipments & Logistics</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Platform-managed courier dispatch, tracking numbers, and delivery lifecycle synchronization
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading shipments...</div>
        ) : shipments.length === 0 ? (
          <div className="p-12 text-center">
            <Truck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-gray-900">No active shipments</h3>
            <p className="text-sm text-gray-500 mt-1">
              Shipments are automatically generated when sellers mark paid orders as Ready for Pickup.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-5 py-3.5 text-left font-semibold text-gray-700">Order</th>
                  <th className="px-5 py-3.5 text-left font-semibold text-gray-700">Pickup (Seller)</th>
                  <th className="px-5 py-3.5 text-left font-semibold text-gray-700">Drop (Buyer)</th>
                  <th className="px-5 py-3.5 text-left font-semibold text-gray-700">Courier Name</th>
                  <th className="px-5 py-3.5 text-left font-semibold text-gray-700">Status</th>
                  <th className="px-5 py-3.5 text-right font-semibold text-gray-700">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {shipments.map((shipment: any) => {
                  const currentStatus = statusSelects[shipment.id] || shipment.status;
                  const currentCourier =
                    courierInputs[shipment.id] ?? (shipment.courierName || 'Platform Logistics');

                  return (
                    <tr key={shipment.id} className="hover:bg-gray-50 transition">
                      <td className="px-5 py-4">
                        <span className="font-mono text-xs font-bold text-gray-900 block">
                          #{shipment.orderId.slice(0, 8).toUpperCase()}
                        </span>
                        <span className="text-xs text-gray-400">
                          Order: {shipment.orderStatus}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-xs text-gray-700 max-w-[180px]">
                        <p className="font-medium text-gray-900">{shipment.pickupAddress?.line1 || 'Warehouse'}</p>
                        <p className="text-gray-500">{shipment.pickupAddress?.city || ''}</p>
                      </td>

                      <td className="px-5 py-4 text-xs text-gray-700 max-w-[180px]">
                        <p className="font-medium text-gray-900">{shipment.dropAddress?.line1 || 'Destination'}</p>
                        <p className="text-gray-500">{shipment.dropAddress?.city || ''}</p>
                      </td>

                      <td className="px-5 py-4">
                        <input
                          type="text"
                          value={currentCourier}
                          onChange={(e) =>
                            setCourierInputs((prev) => ({
                              ...prev,
                              [shipment.id]: e.target.value,
                            }))
                          }
                          className="w-36 px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500"
                        />
                      </td>

                      <td className="px-5 py-4">
                        <select
                          value={currentStatus}
                          onChange={(e) =>
                            setStatusSelects((prev) => ({
                              ...prev,
                              [shipment.id]: e.target.value,
                            }))
                          }
                          className="px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg text-xs font-medium focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value="PICKUP_PENDING">Pickup pending</option>
                          <option value="PICKED_UP">Picked up</option>
                          <option value="IN_TRANSIT">In transit</option>
                          <option value="DELIVERED">Delivered</option>
                          <option value="FAILED">Failed</option>
                        </select>
                      </td>

                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={() => handleUpdate(shipment)}
                          disabled={updateMutation.isPending}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition inline-flex items-center space-x-1 ${
                            updatedId === shipment.id
                              ? 'bg-emerald-600 text-white'
                              : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                          }`}
                        >
                          {updatedId === shipment.id ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Synced</span>
                            </>
                          ) : (
                            <span>Update</span>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
