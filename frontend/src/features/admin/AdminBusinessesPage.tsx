import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { notifyError } from '../../lib/notify';
import { StatusBadge } from '../../components/StatusBadge';
import { Building2, Ban, RotateCcw } from 'lucide-react';

export const AdminBusinessesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('');

  const { data: businesses = [], isLoading } = useQuery({
    queryKey: ['admin-businesses', statusFilter],
    queryFn: () =>
      api.get<any[]>('/admin/orgs', {
        status: statusFilter || undefined,
      }),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'APPROVED' | 'SUSPENDED' }) =>
      api.put(`/admin/orgs/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-businesses'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
    },
    onError: (err: any) => {
      notifyError(err.message || 'Status update failed');
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Businesses & Organizations</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage all registered sellers and buyers across the marketplace
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <label htmlFor="business-status-filter" className="text-sm text-gray-500 font-medium">
            Filter status:
          </label>
          <select
            id="business-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm bg-white border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All statuses</option>
            <option value="APPROVED">Approved</option>
            <option value="PENDING">Pending</option>
            <option value="SUSPENDED">Suspended</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading businesses...</div>
        ) : businesses.length === 0 ? (
          <div className="p-12 text-center">
            <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-gray-900">No businesses found</h3>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3.5 text-left font-semibold text-gray-700">Business</th>
                  <th className="px-6 py-3.5 text-left font-semibold text-gray-700">PAN</th>
                  <th className="px-6 py-3.5 text-left font-semibold text-gray-700">Type</th>
                  <th className="px-6 py-3.5 text-center font-semibold text-gray-700">Status</th>
                  <th className="px-6 py-3.5 text-right font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {businesses.map((biz: any) => (
                  <tr key={biz.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 font-semibold text-gray-900">{biz.name}</td>
                    <td className="px-6 py-4 font-mono text-xs text-gray-600">{biz.panNumber || '—'}</td>
                    <td className="px-6 py-4 text-xs text-gray-700">
                      {biz.canBuy && biz.canSell
                        ? 'Seller & Buyer'
                        : biz.canSell
                        ? 'Seller (Wholesaler)'
                        : 'Buyer (Dealer)'}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <StatusBadge status={biz.status} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      {biz.type !== 'PLATFORM' && (
                        <div className="flex items-center justify-end space-x-2">
                          {biz.status === 'SUSPENDED' ? (
                            <button
                              onClick={() =>
                                toggleStatusMutation.mutate({ id: biz.id, status: 'APPROVED' })
                              }
                              className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 rounded text-xs font-semibold flex items-center space-x-1"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Reinstate</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                if (confirm(`Suspend account for ${biz.name}?`)) {
                                  toggleStatusMutation.mutate({ id: biz.id, status: 'SUSPENDED' });
                                }
                              }}
                              className="px-3 py-1.5 bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 rounded text-xs font-semibold flex items-center space-x-1"
                            >
                              <Ban className="w-3.5 h-3.5" />
                              <span>Suspend</span>
                            </button>
                          )}
                        </div>
                      )}
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
