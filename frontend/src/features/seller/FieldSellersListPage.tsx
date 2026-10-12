import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { formatMoney } from '../../lib/money';
import { StatusBadge } from '../../components/StatusBadge';
import {
  Users,
  Plus,
  Search,
  KeyRound,
  Eye,
  Check,
  Copy,
  AlertTriangle,
  Power,
  X,
} from 'lucide-react';

interface FieldSellerSummary {
  id: string;
  userId: string;
  orgId: string;
  displayName: string;
  phone: string | null;
  status: 'ACTIVE' | 'DISABLED';
  username: string;
  createdAt: string;
  soldToday: { paisa: string; count: number };
  soldThisMonth: { paisa: string; count: number };
  soldAllTime: { paisa: string; count: number };
}

export const FieldSellersListPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedSeller, setSelectedSeller] = useState<FieldSellerSummary | null>(null);
  const [modalType, setModalType] = useState<'reset' | 'status' | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: sellers = [], isLoading, error } = useQuery<FieldSellerSummary[]>({
    queryKey: ['seller-field-sellers'],
    queryFn: () => api.get<FieldSellerSummary[]>('/seller/field-sellers'),
  });

  const resetMutation = useMutation({
    mutationFn: (sellerId: string) =>
      api.post<{ temporaryPassword: string }>(`/seller/field-sellers/${sellerId}/reset-password`, {}),
    onSuccess: (res) => {
      setTempPassword(res.temporaryPassword);
      queryClient.invalidateQueries({ queryKey: ['seller-field-sellers'] });
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Failed to reset password');
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ sellerId, action }: { sellerId: string; action: 'enable' | 'disable' }) =>
      api.post(`/seller/field-sellers/${sellerId}/${action}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seller-field-sellers'] });
      closeModal();
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Failed to update field seller status');
    },
  });

  const closeModal = () => {
    setSelectedSeller(null);
    setModalType(null);
    setTempPassword(null);
    setCopied(false);
    setErrorMsg(null);
  };

  const handleCopyPassword = () => {
    if (!tempPassword) return;
    navigator.clipboard.writeText(tempPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const filtered = sellers.filter((s) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      s.displayName.toLowerCase().includes(q) ||
      s.username.toLowerCase().includes(q) ||
      (s.phone && s.phone.includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Field Sellers</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your moving sales team, reset access passwords, and view live performance
          </p>
        </div>
        <Link
          to="/seller/field-sellers/new"
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium text-sm transition-colors shadow-xs"
        >
          <Plus className="w-4 h-4" />
          Add field seller
        </Link>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, username, or phone..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>
        <div className="text-xs text-gray-500 font-medium">
          Total sellers: <span className="text-gray-900 font-semibold">{sellers.length}</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-sm text-gray-500">Loading field sellers...</div>
        ) : error ? (
          <div className="p-8 text-center text-sm text-rose-600">Failed to load field sellers.</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-base font-medium text-gray-900">
              {sellers.length === 0 ? 'No field sellers yet' : 'No field sellers match your search'}
            </h3>
            <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
              {sellers.length === 0
                ? 'Create logins for your sales agents so they can record sales on the road.'
                : 'Try adjusting your search criteria.'}
            </p>
            {sellers.length === 0 && (
              <div className="mt-4">
                <Link
                  to="/seller/field-sellers/new"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium text-sm transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add field seller
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500 border-b border-gray-200">
                <tr>
                  <th className="px-5 py-3.5">Seller</th>
                  <th className="px-5 py-3.5">Phone</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Today</th>
                  <th className="px-5 py-3.5 text-right">This Month</th>
                  <th className="px-5 py-3.5 text-right">To Date</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50/75 transition-colors">
                    <td className="px-5 py-4">
                      <Link
                        to={`/seller/field-sellers/${s.id}`}
                        className="font-medium text-gray-900 hover:text-emerald-600 transition-colors"
                      >
                        {s.displayName}
                      </Link>
                      <div className="text-xs text-gray-400 font-mono mt-0.5">@{s.username}</div>
                    </td>
                    <td className="px-5 py-4 font-mono text-xs text-gray-700">
                      {s.phone || '—'}
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="font-semibold text-gray-900">
                        {formatMoney(s.soldToday.paisa)}
                      </div>
                      <div className="text-xs text-gray-400">{s.soldToday.count} sales</div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="font-semibold text-gray-900">
                        {formatMoney(s.soldThisMonth.paisa)}
                      </div>
                      <div className="text-xs text-gray-400">{s.soldThisMonth.count} sales</div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="font-semibold text-gray-900">
                        {formatMoney(s.soldAllTime.paisa)}
                      </div>
                      <div className="text-xs text-gray-400">{s.soldAllTime.count} sales</div>
                    </td>
                    <td className="px-5 py-4 text-right space-x-1 whitespace-nowrap">
                      <Link
                        to={`/seller/field-sellers/${s.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors shadow-2xs"
                        title="View details"
                      >
                        <Eye className="w-3.5 h-3.5 text-gray-500" />
                        View
                      </Link>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSeller(s);
                          setModalType('reset');
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-md hover:bg-amber-100 transition-colors shadow-2xs"
                        title="Reset temporary password"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                        Reset PW
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSeller(s);
                          setModalType('status');
                        }}
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md border shadow-2xs transition-colors ${
                          s.status === 'ACTIVE'
                            ? 'text-rose-700 bg-rose-50 border-rose-200 hover:bg-rose-100'
                            : 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
                        }`}
                        title={s.status === 'ACTIVE' ? 'Disable seller' : 'Enable seller'}
                      >
                        <Power className="w-3.5 h-3.5" />
                        {s.status === 'ACTIVE' ? 'Disable' : 'Enable'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reset Password Modal */}
      {modalType === 'reset' && selectedSeller && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-600" />
                Reset Password
              </h3>
              <button
                type="button"
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
                {errorMsg}
              </div>
            )}

            {!tempPassword ? (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Generate a new temporary password for{' '}
                  <span className="font-semibold text-gray-900">{selectedSeller.displayName}</span> (
                  <span className="font-mono text-gray-700">@{selectedSeller.username}</span>)?
                </p>
                <p className="text-xs text-gray-500">
                  This will revoke all active sessions for this seller and require them to choose a
                  new password upon their next login.
                </p>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => resetMutation.mutate(selectedSeller.id)}
                    disabled={resetMutation.isPending}
                    className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50"
                  >
                    {resetMutation.isPending ? 'Generating...' : 'Confirm Reset'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-amber-50 border-2 border-dashed border-amber-300 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-amber-800 uppercase tracking-wide">
                      New Temporary Password
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyPassword}
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-600 text-white rounded-md text-xs font-medium hover:bg-amber-700 transition-colors shadow-2xs"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5" /> Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" /> Copy
                        </>
                      )}
                    </button>
                  </div>
                  <div className="font-mono text-xl font-bold text-gray-900 bg-white p-2.5 rounded-lg border border-amber-200 text-center tracking-widest select-all">
                    {tempPassword}
                  </div>
                </div>

                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2.5 text-xs text-yellow-800">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-yellow-600 mt-0.5" />
                  <div>
                    Share this password securely with the seller. They will be required to change it on
                    first login. It will not be shown again.
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Disable / Enable Confirmation Modal */}
      {modalType === 'status' && selectedSeller && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Power className="w-5 h-5 text-gray-700" />
                {selectedSeller.status === 'ACTIVE' ? 'Disable Field Seller' : 'Enable Field Seller'}
              </h3>
              <button
                type="button"
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
                {errorMsg}
              </div>
            )}

            <p className="text-sm text-gray-600">
              {selectedSeller.status === 'ACTIVE' ? (
                <>
                  Are you sure you want to disable{' '}
                  <span className="font-semibold text-gray-900">{selectedSeller.displayName}</span>?
                  This will immediately revoke their access and block login.
                </>
              ) : (
                <>
                  Are you sure you want to re-enable{' '}
                  <span className="font-semibold text-gray-900">{selectedSeller.displayName}</span>?
                  They will be able to log in and record sales again.
                </>
              )}
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={closeModal}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() =>
                  toggleStatusMutation.mutate({
                    sellerId: selectedSeller.id,
                    action: selectedSeller.status === 'ACTIVE' ? 'disable' : 'enable',
                  })
                }
                disabled={toggleStatusMutation.isPending}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 ${
                  selectedSeller.status === 'ACTIVE'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {toggleStatusMutation.isPending
                  ? 'Saving...'
                  : selectedSeller.status === 'ACTIVE'
                  ? 'Confirm Disable'
                  : 'Confirm Enable'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
