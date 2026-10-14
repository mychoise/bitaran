import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { StatusBadge } from '../../components/StatusBadge';
import {
  Users,
  Plus,
  Search,
  KeyRound,
  Shield,
  Copy,
  Check,
  AlertTriangle,
  Power,
  X,
  UserCheck,
  UserX,
  ArrowUpDown,
} from 'lucide-react';

export interface TeamMember {
  id: string;
  membershipId?: string;
  userId: string;
  name: string;
  email: string;
  role: 'MANAGER' | 'STAFF';
  status: 'ACTIVE' | 'DISABLED';
  createdAt: string;
}

export const TeamPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { user, activeOrg } = useAuth();
  const isOwner = activeOrg?.roleName === 'OWNER';

  const [search, setSearch] = useState('');
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [modalType, setModalType] = useState<'reset' | 'status' | 'role' | null>(null);
  const [newRole, setNewRole] = useState<'MANAGER' | 'STAFF'>('STAFF');
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: members = [], isLoading, error } = useQuery<TeamMember[]>({
    queryKey: ['seller-team-members', activeOrg?.orgId],
    queryFn: () => api.get<TeamMember[]>('/seller/team'),
    enabled: !!activeOrg?.canSell,
  });

  const resetMutation = useMutation({
    mutationFn: (membershipId: string) =>
      api.post<{ temporaryPassword: string }>(`/seller/team/${membershipId}/reset-password`, {}),
    onSuccess: (res) => {
      setTempPassword(res.temporaryPassword);
      queryClient.invalidateQueries({ queryKey: ['seller-team-members'] });
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Failed to reset password');
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ membershipId, action }: { membershipId: string; action: 'enable' | 'disable' }) =>
      api.post(`/seller/team/${membershipId}/${action}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seller-team-members'] });
      closeModal();
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Failed to update member status');
    },
  });

  const changeRoleMutation = useMutation({
    mutationFn: ({ membershipId, role }: { membershipId: string; role: 'MANAGER' | 'STAFF' }) =>
      api.patch(`/seller/team/${membershipId}`, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seller-team-members'] });
      closeModal();
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Failed to change role');
    },
  });

  const closeModal = () => {
    setSelectedMember(null);
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

  const filtered = members.filter((m) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      m.name.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q) ||
      m.role.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Team Management</h1>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">
              {members.length} {members.length === 1 ? 'member' : 'members'}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            {isOwner
              ? 'Create and manage managers and operational staff accounts for your business.'
              : 'Manage operational staff accounts for your business.'}
          </p>
        </div>

        <Link
          to="/seller/team/new"
          className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-gray-900 hover:bg-gray-800 shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          <span>Add team member</span>
        </Link>
      </div>

      {/* Role explanation callout */}
      <div className="bg-blue-50/70 border border-blue-200/80 rounded-2xl p-4 text-xs text-blue-900 flex flex-col sm:flex-row gap-3">
        <Shield className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-blue-950">Hierarchy & Roles Overview</p>
          <p className="text-blue-800">
            <strong>OWNER</strong> has full business authority. <strong>MANAGER</strong> runs daily operations (catalog, stock, orders, field sellers, staff) but cannot refund, void sales, or change payment credentials. <strong>STAFF</strong> can update products, adjust stock, and view incoming orders.
          </p>
        </div>
      </div>

      {/* Search and filters bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search team members..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
          />
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-sm text-gray-500">Loading team members...</div>
        ) : error ? (
          <div className="p-8 text-center text-sm text-rose-600">Failed to load team members.</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Users className="w-10 h-10 text-gray-300 mx-auto" />
            <h3 className="text-base font-bold text-gray-900">No team members found</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              {search
                ? `No members match "${search}". Try clearing your search.`
                : 'Get started by creating accounts for your managers or operations staff.'}
            </p>
            {!search && (
              <Link
                to="/seller/team/new"
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-bold text-white bg-gray-900 hover:bg-gray-800 shadow-xs transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add first team member</span>
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm divide-y divide-gray-200">
              <thead className="bg-gray-50/75 text-2xs font-bold text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">Member</th>
                  <th className="px-6 py-3.5">Email</th>
                  <th className="px-6 py-3.5 text-center">Role</th>
                  <th className="px-6 py-3.5 text-center">Status</th>
                  <th className="px-6 py-3.5">Joined</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {filtered.map((member) => {
                  const memberId = member.id || member.membershipId!;
                  const isCurrentLoggedUser = member.userId === user?.id;

                  return (
                    <tr key={memberId} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-9 h-9 rounded-full bg-gray-100 text-gray-700 font-bold flex items-center justify-center text-xs shrink-0 border border-gray-200">
                            {member.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-semibold text-gray-900 block">{member.name}</span>
                            {isCurrentLoggedUser && (
                              <span className="text-3xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-medium border border-gray-200">
                                You
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-gray-600 font-mono text-xs">{member.email}</td>

                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                            member.role === 'MANAGER'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-slate-50 text-slate-700 border-slate-200'
                          }`}
                        >
                          {member.role}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-center">
                        <StatusBadge status={member.status} />
                      </td>

                      <td className="px-6 py-4 text-xs text-gray-500 whitespace-nowrap">
                        {new Date(member.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          {/* Role Change (Owners only) */}
                          {isOwner && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedMember(member);
                                setNewRole(member.role === 'MANAGER' ? 'STAFF' : 'MANAGER');
                                setModalType('role');
                                setErrorMsg(null);
                              }}
                              className="px-2.5 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition inline-flex items-center space-x-1 shadow-2xs"
                              title="Change Role"
                            >
                              <ArrowUpDown className="w-3.5 h-3.5 text-gray-500" />
                              <span className="hidden md:inline">Change role</span>
                            </button>
                          )}

                          {/* Reset Password */}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedMember(member);
                              setModalType('reset');
                              setErrorMsg(null);
                            }}
                            className="px-2.5 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition inline-flex items-center space-x-1"
                            title="Reset Temporary Password"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                            <span className="hidden md:inline">Reset password</span>
                          </button>

                          {/* Disable / Enable Toggle */}
                          {!isCurrentLoggedUser && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedMember(member);
                                setModalType('status');
                                setErrorMsg(null);
                              }}
                              className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition inline-flex items-center space-x-1 ${
                                member.status === 'ACTIVE'
                                  ? 'text-rose-700 bg-rose-50 border-rose-200 hover:bg-rose-100'
                                  : 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
                              }`}
                              title={member.status === 'ACTIVE' ? 'Disable member' : 'Enable member'}
                            >
                              <Power className="w-3.5 h-3.5" />
                              <span className="hidden md:inline">
                                {member.status === 'ACTIVE' ? 'Disable' : 'Enable'}
                              </span>
                            </button>
                          )}
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

      {/* Modal: Reset Password Confirmation & Result */}
      {modalType === 'reset' && selectedMember && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-600" />
                Reset Temporary Password
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
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {!tempPassword ? (
              <div className="space-y-4">
                <p className="text-xs text-gray-600">
                  Are you sure you want to generate a new temporary password for{' '}
                  <strong className="text-gray-900">{selectedMember.name}</strong> ({selectedMember.email})?
                </p>
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800">
                  This will immediately invalidate their current password and revoke active sessions. They must set a new permanent password on their next sign in.
                </div>
                <div className="flex items-center justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      resetMutation.mutate(selectedMember.id || selectedMember.membershipId!)
                    }
                    disabled={resetMutation.isPending}
                    className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-xs disabled:opacity-50"
                  >
                    {resetMutation.isPending ? 'Generating...' : 'Confirm Reset'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider block text-emerald-800">
                    Temporary Password Generated
                  </span>
                  <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-emerald-300 font-mono text-base font-bold text-gray-900">
                    <span>{tempPassword}</span>
                    <button
                      type="button"
                      onClick={handleCopyPassword}
                      className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-md transition"
                      title="Copy to clipboard"
                    >
                      {copied ? (
                        <Check className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start space-x-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p>
                    <strong>Important:</strong> This password is shown only once and cannot be retrieved later. Share it directly with {selectedMember.name}.
                  </p>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 text-xs font-bold text-white bg-gray-900 hover:bg-gray-800 rounded-xl shadow-xs"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Enable / Disable Confirmation */}
      {modalType === 'status' && selectedMember && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                {selectedMember.status === 'ACTIVE' ? (
                  <>
                    <UserX className="w-5 h-5 text-rose-600" />
                    Disable Team Member
                  </>
                ) : (
                  <>
                    <UserCheck className="w-5 h-5 text-emerald-600" />
                    Enable Team Member
                  </>
                )}
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
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <p className="text-xs text-gray-600 leading-relaxed">
              Are you sure you want to{' '}
              <strong>{selectedMember.status === 'ACTIVE' ? 'disable' : 'enable'}</strong> access for{' '}
              <strong className="text-gray-900">{selectedMember.name}</strong> ({selectedMember.email})?
            </p>

            {selectedMember.status === 'ACTIVE' ? (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
                Disabling will immediately revoke their refresh tokens and block all portal actions with a 403 Forbidden.
              </div>
            ) : (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800">
                Enabling will restore their ability to sign in and perform actions matching their {selectedMember.role} role.
              </div>
            )}

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={closeModal}
                className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() =>
                  toggleStatusMutation.mutate({
                    membershipId: selectedMember.id || selectedMember.membershipId!,
                    action: selectedMember.status === 'ACTIVE' ? 'disable' : 'enable',
                  })
                }
                disabled={toggleStatusMutation.isPending}
                className={`px-4 py-2 text-xs font-bold text-white rounded-xl shadow-xs disabled:opacity-50 ${
                  selectedMember.status === 'ACTIVE'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {toggleStatusMutation.isPending
                  ? 'Saving...'
                  : selectedMember.status === 'ACTIVE'
                  ? 'Disable Account'
                  : 'Enable Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Change Role (Owner only) */}
      {modalType === 'role' && selectedMember && isOwner && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <ArrowUpDown className="w-5 h-5 text-blue-600" />
                Change Member Role
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
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <p className="text-xs text-gray-600">
              Select the new role for <strong className="text-gray-900">{selectedMember.name}</strong>:
            </p>

            <div className="space-y-2">
              <label
                className={`flex items-start space-x-3 p-3.5 rounded-xl border cursor-pointer transition ${
                  newRole === 'MANAGER'
                    ? 'bg-blue-50/70 border-blue-400 ring-1 ring-blue-400'
                    : 'bg-white border-gray-200 hover:bg-gray-50'
                }`}
              >
                <input
                  type="radio"
                  name="roleSelect"
                  value="MANAGER"
                  checked={newRole === 'MANAGER'}
                  onChange={() => setNewRole('MANAGER')}
                  className="mt-0.5 text-blue-600"
                />
                <div>
                  <div className="text-xs font-bold text-gray-900">Manager</div>
                  <div className="text-3xs text-gray-500 mt-0.5">
                    Can manage products, inventory, orders, field sellers, and staff members.
                  </div>
                </div>
              </label>

              <label
                className={`flex items-start space-x-3 p-3.5 rounded-xl border cursor-pointer transition ${
                  newRole === 'STAFF'
                    ? 'bg-blue-50/70 border-blue-400 ring-1 ring-blue-400'
                    : 'bg-white border-gray-200 hover:bg-gray-50'
                }`}
              >
                <input
                  type="radio"
                  name="roleSelect"
                  value="STAFF"
                  checked={newRole === 'STAFF'}
                  onChange={() => setNewRole('STAFF')}
                  className="mt-0.5 text-blue-600"
                />
                <div>
                  <div className="text-xs font-bold text-gray-900">Staff</div>
                  <div className="text-3xs text-gray-500 mt-0.5">
                    Can edit products, adjust stock levels, and view orders.
                  </div>
                </div>
              </label>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={closeModal}
                className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() =>
                  changeRoleMutation.mutate({
                    membershipId: selectedMember.id || selectedMember.membershipId!,
                    role: newRole,
                  })
                }
                disabled={changeRoleMutation.isPending || newRole === selectedMember.role}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs disabled:opacity-50"
              >
                {changeRoleMutation.isPending ? 'Updating...' : 'Update Role'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
