import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { KeyRound, CheckCircle2, AlertCircle, Lock } from 'lucide-react';

export const ChangePasswordPage: React.FC = () => {
  const { user, updateUser, isFieldSeller, activeOrg } = useAuth();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    try {
      setLoading(true);
      const res = await api.post<{
        message: string;
        tokens: { accessToken: string; refreshToken: string };
      }>('/auth/password', {
        oldPassword: currentPassword.trim() || undefined,
        newPassword: newPassword.trim(),
      });

      api.setTokens(res.tokens.accessToken, res.tokens.refreshToken);
      updateUser({ mustChangePassword: false });
      setSuccess(true);

      setTimeout(() => {
        if (isFieldSeller) {
          navigate('/field/home', { replace: true });
        } else if (activeOrg?.canSell) {
          if (activeOrg.roleName === 'OWNER' || activeOrg.permissions?.includes('report.view')) {
            navigate('/seller/dashboard', { replace: true });
          } else {
            navigate('/seller/products', { replace: true });
          }
        } else {
          navigate('/', { replace: true });
        }
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-sm space-y-6">
        <div className="text-center">
          <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-2xl mx-auto flex items-center justify-center">
            <KeyRound className="w-6 h-6" />
          </div>
          <h1 className="mt-4 text-xl font-bold text-gray-900 tracking-tight">
            {user?.mustChangePassword ? 'Create your permanent password' : 'Change password'}
          </h1>
          <p className="mt-1 text-xs text-gray-500">
            {user?.mustChangePassword
              ? 'You are signing in with a temporary password. Please set a new permanent password to continue.'
              : 'Choose a strong password to protect your Bitaran account.'}
          </p>
        </div>

        {error && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="font-semibold">Password updated successfully! Redirecting...</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!user?.mustChangePassword && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Current password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  required
                  className="w-full pl-10 pr-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              New password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
                minLength={8}
                className="w-full pl-10 pr-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Confirm new password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                required
                minLength={8}
                className="w-full pl-10 pr-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || success}
            className="w-full mt-2 py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-sm font-bold shadow-xs transition disabled:opacity-50"
          >
            {loading ? 'Updating password...' : 'Save and continue'}
          </button>
        </form>
      </div>
    </div>
  );
};
