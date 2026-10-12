import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import {
  UserPlus,
  ArrowLeft,
  Copy,
  Check,
  AlertTriangle,
  CheckCircle2,
  Eye,
  Plus,
} from 'lucide-react';

interface CreatedSellerResponse {
  id: string;
  userId: string;
  orgId: string;
  displayName: string;
  phone: string | null;
  status: string;
  username: string;
  temporaryPassword: string;
  createdAt: string;
}

export const AddFieldSellerPage: React.FC = () => {
  const queryClient = useQueryClient();

  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [createdSeller, setCreatedSeller] = useState<CreatedSellerResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const createMutation = useMutation({
    mutationFn: (data: { displayName: string; phone?: string; username: string }) =>
      api.post<CreatedSellerResponse>('/seller/field-sellers', data),
    onSuccess: (res) => {
      setCreatedSeller(res);
      queryClient.invalidateQueries({ queryKey: ['seller-field-sellers'] });
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Failed to create field seller');
    },
  });

  const handleUsernameChange = (val: string) => {
    const cleaned = val.toLowerCase().replace(/[^a-z0-9.]/g, '');
    setUsername(cleaned);

    if (cleaned.length > 0 && cleaned.length < 4) {
      setUsernameError('Username must be at least 4 characters');
    } else if (cleaned.length > 30) {
      setUsernameError('Username cannot exceed 30 characters');
    } else {
      setUsernameError(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanUsername = username.trim().toLowerCase();
    if (cleanUsername.length < 4 || cleanUsername.length > 30) {
      setUsernameError('Username must be between 4 and 30 characters');
      return;
    }

    if (!displayName.trim()) {
      setErrorMsg('Full name is required');
      return;
    }

    createMutation.mutate({
      displayName: displayName.trim(),
      phone: phone.trim() ? phone.trim() : undefined,
      username: cleanUsername,
    });
  };

  const handleCopyPassword = () => {
    if (!createdSeller) return;
    navigator.clipboard.writeText(createdSeller.temporaryPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleResetForm = () => {
    setDisplayName('');
    setPhone('');
    setUsername('');
    setUsernameError(null);
    setErrorMsg(null);
    setCreatedSeller(null);
    setCopied(false);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          to="/seller/field-sellers"
          className="p-2 text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Add Field Seller</h1>
          <p className="text-sm text-gray-500">
            Create a mobile sales representative login with temporary credentials
          </p>
        </div>
      </div>

      {createdSeller ? (
        /* Success Screen */
        <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-xs space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Field Seller Created Successfully</h2>
            <p className="text-sm text-gray-500">
              Account created for <span className="font-semibold text-gray-800">{createdSeller.displayName}</span> (
              <span className="font-mono text-emerald-700">@{createdSeller.username}</span>)
            </p>
          </div>

          {/* Highlighted Temporary Password Box */}
          <div className="bg-amber-50 border-2 border-dashed border-amber-300 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-900 uppercase tracking-wider">
                Temporary Password
              </span>
              <button
                type="button"
                onClick={handleCopyPassword}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-medium hover:bg-amber-700 transition-colors shadow-2xs cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" /> Copied to clipboard!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" /> Copy password
                  </>
                )}
              </button>
            </div>
            <div className="font-mono text-2xl font-bold text-gray-900 bg-white p-3 rounded-lg border border-amber-200 text-center tracking-widest select-all shadow-inner">
              {createdSeller.temporaryPassword}
            </div>
          </div>

          {/* Spec Warning Message */}
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl flex items-start gap-3 text-sm text-yellow-900">
            <AlertTriangle className="w-5 h-5 shrink-0 text-yellow-600 mt-0.5" />
            <div className="font-medium">
              Share this password securely with the seller. They will be required to change it on
              first login. It will not be shown again.
            </div>
          </div>

          {/* Credentials Summary */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-2 text-sm">
            <div className="text-xs font-semibold text-gray-500 uppercase">Login details to share:</div>
            <div className="flex justify-between py-1 border-b border-gray-200/60">
              <span className="text-gray-500">Login URL:</span>
              <span className="font-mono text-xs text-gray-800">/field/login</span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-200/60">
              <span className="text-gray-500">Username:</span>
              <span className="font-mono font-semibold text-gray-900">@{createdSeller.username}</span>
            </div>
            {createdSeller.phone && (
              <div className="flex justify-between py-1">
                <span className="text-gray-500">Phone:</span>
                <span className="font-mono text-gray-900">{createdSeller.phone}</span>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Link
              to={`/seller/field-sellers/${createdSeller.id}`}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-medium text-sm transition-colors shadow-xs"
            >
              <Eye className="w-4 h-4" />
              View seller profile
            </Link>
            <button
              type="button"
              onClick={handleResetForm}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-medium text-sm transition-colors shadow-2xs"
            >
              <Plus className="w-4 h-4" />
              Add another seller
            </button>
            <Link
              to="/seller/field-sellers"
              className="px-4 py-2.5 text-center text-sm font-medium text-gray-500 hover:text-gray-800 rounded-xl hover:bg-gray-100 transition-colors"
            >
              Back to list
            </Link>
          </div>
        </div>
      ) : (
        /* Create Form */
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl border border-gray-200 p-8 shadow-xs space-y-6"
        >
          {errorMsg && (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl">
              {errorMsg}
            </div>
          )}

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1.5">
                Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Ramesh Shrestha"
                className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                The seller's public display name shown on invoices and receipts.
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1.5">
                Username <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-mono text-sm">
                  @
                </span>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => handleUsernameChange(e.target.value)}
                  placeholder="ramesh.sales"
                  className={`w-full pl-8 pr-3.5 py-2.5 text-sm font-mono border rounded-xl focus:outline-hidden focus:ring-2 ${
                    usernameError
                      ? 'border-rose-300 focus:ring-rose-500 focus:border-rose-500'
                      : 'border-gray-300 focus:ring-emerald-500 focus:border-emerald-500'
                  }`}
                />
              </div>
              {usernameError ? (
                <p className="text-xs text-rose-600 mt-1">{usernameError}</p>
              ) : (
                <p className="text-xs text-gray-500 mt-1">
                  4 to 30 characters. Lowercase letters, numbers, and dots only. Unique across the platform.
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1.5">
                Phone Number <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 9841234567"
                className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Mobile contact for the field seller. Must be unique if provided.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
            <Link
              to="/seller/field-sellers"
              className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={createMutation.isPending || !!usernameError || !displayName || !username}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-colors shadow-xs disabled:opacity-50"
            >
              <UserPlus className="w-4 h-4" />
              {createMutation.isPending ? 'Creating Account...' : 'Create Field Seller'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
