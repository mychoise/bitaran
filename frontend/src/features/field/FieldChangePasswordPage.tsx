import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { KeyRound, CheckCircle2, AlertCircle } from 'lucide-react';

export const FieldChangePasswordPage: React.FC = () => {
  const { user, updateUser } = useAuth();
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
        navigate('/field/home');
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto pt-6 px-4">
      <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-xs space-y-6">
        <div className="text-center">
          <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-2xl mx-auto flex items-center justify-center">
            <KeyRound className="w-6 h-6" />
          </div>
          <h1 className="mt-3 text-xl font-bold text-gray-900">
            {user?.mustChangePassword ? 'Create your password' : 'Change password'}
          </h1>
          <p className="mt-1 text-xs text-gray-500">
            {user?.mustChangePassword
              ? 'You are signing in with a temporary password. Please set a new permanent password to continue.'
              : 'Choose a strong password to protect your field account.'}
          </p>
        </div>

        {error && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="font-semibold">Password updated! Redirecting to home...</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!user?.mustChangePassword && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Current password
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Current password"
                className="w-full px-3.5 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[48px]"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              New password (min 8 characters)
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new permanent password"
              className="w-full px-3.5 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[48px]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Confirm new password
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat new permanent password"
              className="w-full px-3.5 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[48px]"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading || success}
              className="w-full flex items-center justify-center px-4 py-3.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold rounded-xl shadow-md min-h-[50px] text-sm transition disabled:opacity-50"
            >
              {loading ? 'Updating password...' : 'Set new password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
