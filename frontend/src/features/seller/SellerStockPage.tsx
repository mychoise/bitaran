import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Layers, Check } from 'lucide-react';

export const SellerStockPage: React.FC = () => {
  const { activeOrg } = useAuth();
  const queryClient = useQueryClient();
  const [deltas, setDeltas] = useState<Record<string, string>>({});
  const [adjustedId, setAdjustedId] = useState<string | null>(null);

  const { data: stockItems = [], isLoading } = useQuery({
    queryKey: ['seller-stock', activeOrg?.orgId],
    queryFn: () => api.get<any[]>('/inventory/stock'),
    enabled: !!activeOrg?.canSell,
  });

  const adjustMutation = useMutation({
    mutationFn: ({ variantId, delta }: { variantId: string; delta: number }) =>
      api.post(`/inventory/stock/${variantId}/adjust`, { delta }),
    onSuccess: (_, { variantId }) => {
      queryClient.invalidateQueries({ queryKey: ['seller-stock'] });
      setDeltas((prev) => ({ ...prev, [variantId]: '' }));
      setAdjustedId(variantId);
      setTimeout(() => setAdjustedId(null), 2000);
    },
    onError: (err: any) => {
      alert(err.message || 'Failed to adjust stock');
    },
  });

  const handleApply = (variantId: string) => {
    const deltaStr = deltas[variantId];
    if (!deltaStr || deltaStr === '0') return;
    const delta = parseInt(deltaStr, 10);
    if (isNaN(delta)) return;

    adjustMutation.mutate({ variantId, delta });
  };

  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-gray-200">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Inventory & Stock</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          View on-hand quantities, order reservations, and apply manual inventory adjustments
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading stock data...</div>
        ) : stockItems.length === 0 ? (
          <div className="p-12 text-center">
            <Layers className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-gray-900">No inventory found</h3>
            <p className="text-sm text-gray-500 mt-1">
              Add products and variants to begin tracking warehouse stock.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3.5 text-left font-semibold text-gray-700">Product</th>
                  <th className="px-6 py-3.5 text-left font-semibold text-gray-700">SKU</th>
                  <th className="px-6 py-3.5 text-right font-semibold text-gray-700">On hand</th>
                  <th className="px-6 py-3.5 text-right font-semibold text-gray-700">Reserved</th>
                  <th className="px-6 py-3.5 text-right font-semibold text-gray-700">Available</th>
                  <th className="px-6 py-3.5 text-center font-semibold text-gray-700">Adjust quantity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {stockItems.map((item: any) => {
                  const onHand = item.qtyOnHand ?? 0;
                  const reserved = item.qtyReserved ?? 0;
                  const available = onHand - reserved;
                  const deltaVal = deltas[item.variantId] || '';

                  return (
                    <tr key={item.variantId} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4 font-semibold text-gray-900">{item.productName}</td>
                      <td className="px-6 py-4 font-mono text-xs text-gray-500">{item.sku}</td>
                      <td className="px-6 py-4 text-right font-medium text-gray-900">{onHand}</td>
                      <td className="px-6 py-4 text-right font-medium text-amber-600">{reserved}</td>
                      <td className="px-6 py-4 text-right font-bold text-emerald-600">
                        {available}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center space-x-2">
                          <input
                            type="number"
                            placeholder="+/- qty"
                            value={deltaVal}
                            onChange={(e) =>
                              setDeltas((prev) => ({
                                ...prev,
                                [item.variantId]: e.target.value,
                              }))
                            }
                            className="w-24 px-2.5 py-1.5 border border-gray-300 rounded-lg text-center text-xs focus:ring-1 focus:ring-gray-900"
                          />
                          <button
                            onClick={() => handleApply(item.variantId)}
                            disabled={!deltaVal || adjustMutation.isPending}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1 ${
                              adjustedId === item.variantId
                                ? 'bg-emerald-600 text-white'
                                : 'bg-gray-900 hover:bg-gray-800 text-white disabled:opacity-40'
                            }`}
                          >
                            {adjustedId === item.variantId ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>Done</span>
                              </>
                            ) : (
                              <span>Apply</span>
                            )}
                          </button>
                        </div>
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
