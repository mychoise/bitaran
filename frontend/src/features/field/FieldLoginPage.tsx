import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import { APP_NAME } from '../../config/app.config';
import { Lock, User, AlertCircle } from 'lucide-react';

export const FieldLoginPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password) {
      setError('Please enter both username and password.');
      return;
    }

    try {
      setLoading(true);
      const res = await api.post<{
        tokens: { accessToken: string; refreshToken: string };
        user: { id: string; name: string; username?: string; mustChangePassword?: boolean };
        memberships: any[];
      }>('/auth/field/login', {
        username: username.trim(),
        password,
      });

      login({
        user: {
          id: res.user.id,
          name: res.user.name,
          username: res.user.username,
          mustChangePassword: res.user.mustChangePassword,
        },
        tokens: res.tokens,
        memberships: res.memberships,
      });

      if (res.user.mustChangePassword) {
        navigate('/field/password');
      } else {
        navigate('/field/home');
      }
    } catch (err: any) {
      setError(err.message || 'Invalid username or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full mx-auto">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-blue-600 rounded-2xl mx-auto flex items-center justify-center text-white text-2xl font-bold shadow-md">
            {APP_NAME.charAt(0)}
          </div>
          <h1 className="mt-4 text-2xl font-bold text-gray-900 tracking-tight">
            Field seller sign in
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {APP_NAME} Mobile Sales Portal
          </p>
        </div>

        <div className="bg-white py-8 px-6 shadow-sm border border-gray-200 rounded-2xl">
          {error && (
            <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-3 text-rose-700 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="username"
                className="block text-sm font-semibold text-gray-700 mb-1.5"
              >
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <User className="w-5 h-5" />
                </div>
                <input
                  id="username"
                  type="text"
                  autoCapitalize="none"
                  autoCorrect="off"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. field1"
                  className="block w-full pl-11 pr-3 py-3 border border-gray-300 rounded-xl text-base placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[48px]"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-semibold text-gray-700 mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="block w-full pl-11 pr-3 py-3 border border-gray-300 rounded-xl text-base placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[48px]"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center px-4 py-3 border border-transparent rounded-xl shadow-xs text-base font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 min-h-[48px] transition cursor-pointer"
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </div>
          </form>

          {/* Quick Demo Fill Buttons */}
          <div className="mt-6 pt-5 border-t border-gray-100">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
              Demo Accounts (Click to Fill)
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  setUsername('field1');
                  setPassword('Password123!');
                  setError(null);
                }}
                className="px-3.5 py-2.5 text-xs bg-gray-50 hover:bg-gray-100 text-gray-800 rounded-xl border border-gray-200 transition font-medium cursor-pointer text-left flex items-center justify-between"
              >
                <div>
                  <span className="font-semibold block text-gray-900">Ramesh Shrestha (@field1)</span>
                  <span className="text-[11px] text-gray-500">Himalayan Wholesale Distributors</span>
                </div>
                <span className="text-xs text-blue-600 font-semibold shrink-0">Select</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setUsername('field2');
                  setPassword('Password123!');
                  setError(null);
                }}
                className="px-3.5 py-2.5 text-xs bg-gray-50 hover:bg-gray-100 text-gray-800 rounded-xl border border-gray-200 transition font-medium cursor-pointer text-left flex items-center justify-between"
              >
                <div>
                  <span className="font-semibold block text-gray-900">Sita Gurung (@field2)</span>
                  <span className="text-[11px] text-gray-500">Himalayan Wholesale Distributors</span>
                </div>
                <span className="text-xs text-blue-600 font-semibold shrink-0">Select</span>
              </button>
            </div>
            <p className="text-[11px] text-gray-400 mt-2">
              Default password: <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-700 font-mono">Password123!</code>
            </p>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-100 text-center">
            <Link to="/login" className="text-xs text-gray-500 hover:text-gray-800">
              &larr; Wholesaler & dealer sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
