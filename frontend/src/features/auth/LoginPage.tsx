import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { APP_NAME } from '../../config/app.config';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { CheckCircle2, Eye, EyeOff } from 'lucide-react';

interface LoginForm {
  email: string;
  password: string;
}

export const LoginPage: React.FC = () => {
  const { register, handleSubmit, setValue, formState: { errors } } = useForm<LoginForm>();
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const demoAccounts = [
    { label: 'Seller 1 (Himalayan)', email: 'seller1@demo.test', role: 'Wholesaler' },
    { label: 'Seller 2 (Everest)', email: 'seller2@demo.test', role: 'Wholesaler' },
    { label: 'Buyer 1 (Kathmandu Mart)', email: 'buyer1@demo.test', role: 'Dealer' },
    { label: 'Dealer 1 (Kathmandu Mart)', email: 'dealer1@demo.test', role: 'Dealer' },
    { label: 'Dual (Apex Trade)', email: 'both@demo.test', role: 'Buyer & Seller' },
    { label: 'Platform Admin', email: 'admin@demo.test', role: 'Staff' },
  ];

  const fillCredentials = (email: string) => {
    setValue('email', email, { shouldValidate: true });
    setValue('password', 'Password123!', { shouldValidate: true });
    setServerError(null);
  };

  const onSubmit = async (data: LoginForm) => {
    try {
      setLoading(true);
      setServerError(null);
      const res = await api.post<any>('/auth/login', {
        email: data.email.trim(),
        password: data.password.trim(),
      });
      login(res);

      // Check if user has buyer or seller org
      const firstOrg = res.memberships?.[0];
      if (firstOrg?.roleName === 'ADMIN' || firstOrg?.roleName === 'SUPER_ADMIN') {
        navigate('/admin/dashboard');
      } else if (firstOrg?.canSell) {
        navigate('/seller/dashboard');
      } else {
        navigate('/browse');
      }
    } catch (err: any) {
      setServerError(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 lg:grid lg:grid-cols-2">
      {/* Brand panel (desktop only) */}
      <aside className="hidden lg:flex flex-col justify-between bg-indigo-700 text-white p-12">
        <span className="text-2xl font-extrabold tracking-tight">{APP_NAME}</span>
        <div className="max-w-md">
          <h2 className="text-4xl font-bold leading-tight">
            Wholesale buying and selling, in one place.
          </h2>
          <p className="mt-4 text-indigo-100 text-base leading-relaxed">
            Order from several verified sellers in a single checkout, and manage stock, orders and
            deliveries without the back-and-forth.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-indigo-50">
            <li className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-indigo-200" aria-hidden="true" />
              <span>Every business is reviewed and approved before it can trade</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-indigo-200" aria-hidden="true" />
              <span>One cart, split automatically into an order per seller</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-indigo-200" aria-hidden="true" />
              <span>Platform-managed delivery with live order status</span>
            </li>
          </ul>
        </div>
        <p className="text-xs text-indigo-200">For dealers and wholesalers</p>
      </aside>

      <div className="flex flex-col justify-center px-4 py-12 sm:px-6 lg:px-12">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 lg:hidden">{APP_NAME}</h1>
        <h2 className="mt-4 lg:mt-0 text-2xl font-bold text-gray-900">Sign in</h2>
        <p className="mt-1 text-sm text-gray-600">Welcome back. Sign in to your business account.</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm rounded-xl border border-gray-200 sm:px-10">
          {serverError && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg">
              {serverError}
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <input
                id="email"
                type="email"
                placeholder="seller1@demo.test"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                {...register('email', { required: 'Email is required' })}
              />
              {errors.email && (
                <p className="mt-1 text-xs text-rose-600">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="relative mt-1">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Password123!"
                  className="block w-full pl-3 pr-11 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  {...register('password', { required: 'Password is required' })}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-gray-700"
                  style={{ minHeight: 0 }}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-rose-600">{errors.password.message}</p>
              )}
            </div>

            <div className="flex items-center justify-between text-sm">
              <a href="#forgot" onClick={(e) => { e.preventDefault(); alert('Password reset will be sent to your registered email.'); }} className="text-gray-500 hover:text-gray-900">
                Forgot password?
              </a>
              <Link to="/register" className="font-medium text-indigo-600 hover:text-indigo-500">
                Register your business
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          {/* Quick Demo Fill Buttons */}
          <div className="mt-6 pt-5 border-t border-gray-100">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
              Demo Accounts (Click to Fill)
            </p>
            <div className="flex flex-wrap gap-1.5">
              {demoAccounts.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => fillCredentials(acc.email)}
                  className="px-2.5 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-md border border-gray-200 transition font-medium"
                >
                  {acc.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-gray-400 mt-2">
              Default demo password: <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-700 font-mono">Password123!</code>
            </p>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-100 text-center">
            <Link to="/platform/login" className="text-xs text-gray-400 hover:text-gray-600">
              Platform staff sign in &rarr;
            </Link>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};
