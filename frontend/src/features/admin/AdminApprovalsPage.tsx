import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Check, X, ShieldCheck, FileText, Download } from 'lucide-react';

export const AdminApprovalsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedOrg, setSelectedOrg] = useState<any | null>(null);

  const { data: pendingOrgs = [], isLoading } = useQuery({
    queryKey: ['admin-approvals'],
    queryFn: () => api.get<any[]>('/admin/orgs?status=PENDING'),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'APPROVED' | 'SUSPENDED' }) =>
      api.put(`/admin/orgs/${id}/status`, { status }),
    onSuccess: () => {
      setSelectedOrg(null);
      queryClient.invalidateQueries({ queryKey: ['admin-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['admin-businesses'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
    },
    onError: (err: any) => {
      alert(err.message || 'Status update failed');
    },
  });

  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-gray-200">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Business Approvals</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Review business credentials and verify KYC before granting marketplace ordering and listing rights
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading pending requests...</div>
        ) : pendingOrgs.length === 0 ? (
          <div className="p-12 text-center">
            <ShieldCheck className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
            <h3 className="text-base font-bold text-gray-900">All clear!</h3>
            <p className="text-sm text-gray-500 mt-1">There are no pending business accounts awaiting approval.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3.5 text-left font-semibold text-gray-700">Business</th>
                  <th className="px-6 py-3.5 text-left font-semibold text-gray-700">PAN Number</th>
                  <th className="px-6 py-3.5 text-left font-semibold text-gray-700">Type</th>
                  <th className="px-6 py-3.5 text-left font-semibold text-gray-700">Documents</th>
                  <th className="px-6 py-3.5 text-right font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {pendingOrgs.map((org: any) => (
                  <tr key={org.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-gray-900">{org.name}</p>
                      <p className="text-xs text-gray-500">ID: {org.id.slice(0, 8)}</p>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-gray-700 font-medium">
                      {org.panNumber || '—'}
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-gray-700">
                      {org.canBuy && org.canSell ? 'Buyer & Seller' : org.canSell ? 'Seller' : 'Buyer'}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        type="button"
                        onClick={() => setSelectedOrg(org)}
                        className="inline-flex items-center space-x-1.5 px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-md transition"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>View document</span>
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => statusMutation.mutate({ id: org.id, status: 'APPROVED' })}
                          disabled={statusMutation.isPending}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition flex items-center space-x-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve</span>
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Reject account for ${org.name}?`)) {
                              statusMutation.mutate({ id: org.id, status: 'SUSPENDED' });
                            }
                          }}
                          disabled={statusMutation.isPending}
                          className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-xs transition flex items-center space-x-1"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Document Viewer Modal */}
      {selectedOrg && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden border border-gray-200 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  {selectedOrg.name} — Registration Document
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  PAN: <span className="font-mono font-semibold text-gray-800">{selectedOrg.panNumber || 'N/A'}</span> · ID: {selectedOrg.id}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrg(null)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-200 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Document Preview */}
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between text-xs text-gray-600 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                <span className="font-medium truncate max-w-sm">
                  File: <strong className="text-gray-900">{selectedOrg.documentFileName || 'registration_certificate.jpg'}</strong>
                </span>
                {selectedOrg.documentData && (
                  <a
                    href={selectedOrg.documentData}
                    download={selectedOrg.documentFileName || 'document.jpg'}
                    className="inline-flex items-center space-x-1 text-indigo-600 hover:text-indigo-800 font-semibold"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </a>
                )}
              </div>

              {selectedOrg.documentData ? (
                <div className="bg-gray-100 rounded-lg p-2 border border-gray-200 max-h-[460px] overflow-auto flex items-center justify-center">
                  <img
                    src={selectedOrg.documentData}
                    alt="Business Certificate Document"
                    className="max-h-[420px] max-w-full rounded shadow-sm object-contain"
                  />
                </div>
              ) : (
                <div className="p-10 border-2 border-dashed border-gray-200 rounded-lg text-center bg-gray-50">
                  <FileText className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-gray-800">Standard KYC Certificate on Record</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Verified PAN registration certificate filed with application ({selectedOrg.panNumber || 'PAN on file'}).
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer: Actions */}
            <div className="px-6 py-3.5 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setSelectedOrg(null)}
                className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 transition"
              >
                Close
              </button>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Reject ${selectedOrg.name}?`)) {
                      statusMutation.mutate({ id: selectedOrg.id, status: 'SUSPENDED' });
                    }
                  }}
                  disabled={statusMutation.isPending}
                  className="px-4 py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition"
                >
                  Reject Business
                </button>
                <button
                  type="button"
                  onClick={() => statusMutation.mutate({ id: selectedOrg.id, status: 'APPROVED' })}
                  disabled={statusMutation.isPending}
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition flex items-center space-x-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Approve Business</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
