import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import {
  Users,
  ArrowLeft,
  Check,
  Copy,
  AlertTriangle,
  UserCheck,
} from 'lucide-react';

interface CreateTeamResponse {
  id?: string;
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  role: 'MANAGER' | 'STAFF';
  status: string;
  temporaryPassword: string;
}

export const AddTeamMemberPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { activeOrg } = useAuth();
  const isOwner = activeOrg?.roleName === 'OWNER';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'MANAGER' | 'STAFF'>('STAFF');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Result state after creation
  const [createdResult, setCreatedResult] = useState<CreateTeamResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const createMutation = useMutation({
    mutationFn: (data: { name: string; email: string; role: 'MANAGER' | 'STAFF' }) =>
      api.post<CreateTeamResponse>('/seller/team', data),
    onSuccess: (res) => {
      setCreatedResult(res);
      queryClient.invalidateQueries({ queryKey: ['seller-team-members'] });
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Failed to create team member');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!name.trim()) {
      setErrorMsg('Member name is required');
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      setErrorMsg('A valid email address is required');
      return;
    }

    createMutation.mutate({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role,
    });
  };

  const handleCopyPassword = () => {
    if (!createdResult?.temporaryPassword) return;
    navigator.clipboard.writeText(createdResult.temporaryPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleResetForAnother = () => {
    setName('');
    setEmail('');
    setRole('STAFF');
    setErrorMsg(null);
    setCreatedResult(null);
    setCopied(false);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Back button */}
      <Link
        to="/seller/team"
        className="inline-flex items-center space-x-1.5 text-xs font-semibold text-gray-500 hover:text-gray-900 transition"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to team</span>
      </Link>

      <div className="bg-white border border-gray-200 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
        <div>
          <div className="w-12 h-12 bg-gray-900 text-white rounded-2xl flex items-center justify-center mb-4">
            <Users className="w-6 h-6" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
            Add team member
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Create an operational account for your business. A temporary password will be generated for them to sign in.
          </p>
        </div>

        {errorMsg && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {!createdResult ? (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Full name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Ramesh Thapa"
                required
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Email address <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. ramesh@example.com"
                required
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-2xs text-gray-400 mt-1">
                The member will use this email address to sign in to the Bitaran portal.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Role <span className="text-rose-500">*</span>
              </label>

              <div className="space-y-2.5">
                {isOwner && (
                  <label
                    className={`flex items-start space-x-3 p-3.5 rounded-xl border cursor-pointer transition ${
                      role === 'MANAGER'
                        ? 'bg-blue-50/70 border-blue-400 ring-1 ring-blue-400'
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value="MANAGER"
                      checked={role === 'MANAGER'}
                      onChange={() => setRole('MANAGER')}
                      className="mt-0.5 text-blue-600"
                    />
                    <div>
                      <div className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                        <span>Manager</span>
                        <span className="px-1.5 py-0.2 rounded text-3xs font-semibold bg-blue-100 text-blue-800">
                          Operations Admin
                        </span>
                      </div>
                      <div className="text-2xs text-gray-500 mt-0.5 leading-relaxed">
                        Manages day-to-day operations: products catalog, inventory, order processing, field sellers, and staff accounts. Cannot issue refunds, void field sales, or touch billing.
                      </div>
                    </div>
                  </label>
                )}

                <label
                  className={`flex items-start space-x-3 p-3.5 rounded-xl border cursor-pointer transition ${
                    role === 'STAFF'
                      ? 'bg-blue-50/70 border-blue-400 ring-1 ring-blue-400'
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value="STAFF"
                    checked={role === 'STAFF'}
                    onChange={() => setRole('STAFF')}
                    className="mt-0.5 text-blue-600"
                  />
                  <div>
                    <div className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                      <span>Staff</span>
                      <span className="px-1.5 py-0.2 rounded text-3xs font-semibold bg-gray-100 text-gray-700">
                        Warehouse / Catalog
                      </span>
                    </div>
                    <div className="text-2xs text-gray-500 mt-0.5 leading-relaxed">
                      Can edit product details, adjust inventory stock levels, and view incoming orders.
                    </div>
                  </div>
                </label>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end space-x-3">
              <Link
                to="/seller/team"
                className="px-4 py-2.5 text-xs font-semibold text-gray-600 hover:text-gray-900"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="px-5 py-2.5 text-xs font-bold text-white bg-gray-900 hover:bg-gray-800 rounded-xl shadow-xs transition disabled:opacity-50"
              >
                {createMutation.isPending ? 'Creating member...' : 'Create team member'}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 space-y-3">
              <div className="flex items-center space-x-2">
                <UserCheck className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-sm">Team member created successfully!</h3>
              </div>
              <p className="text-xs text-emerald-800">
                An account for <strong>{createdResult.name}</strong> ({createdResult.email}) with role{' '}
                <strong>{createdResult.role}</strong> is ready.
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                Temporary Password
              </label>
              <div className="flex items-center justify-between p-4 bg-gray-50 border border-gray-300 rounded-2xl font-mono text-lg font-bold text-gray-900">
                <span className="tracking-wider">{createdResult.temporaryPassword}</span>
                <button
                  type="button"
                  onClick={handleCopyPassword}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-gray-300 hover:bg-gray-100 rounded-xl text-xs font-bold text-gray-700 transition shadow-2xs"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span className="text-emerald-700">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-gray-500" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">Important Notice</p>
                <p className="text-amber-800">
                  This password is shown only once and cannot be retrieved again. Share it with the person directly. They will be prompted to create their own permanent password on their first login.
                </p>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleResetForAnother}
                className="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-xl transition shadow-2xs text-center"
              >
                Add another member
              </button>
              <button
                type="button"
                onClick={() => navigate('/seller/team')}
                className="w-full sm:w-auto px-5 py-2.5 text-xs font-bold text-white bg-gray-900 hover:bg-gray-800 rounded-xl shadow-xs transition text-center"
              >
                Done & view team
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
