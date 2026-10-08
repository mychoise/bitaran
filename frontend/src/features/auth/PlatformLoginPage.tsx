import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { APP_NAME } from '../../config/app.config';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';

interface LoginForm {
  email: string;
  password: string;
}

export const PlatformLoginPage: React.FC = () => {
  const { register, handleSubmit, setValue, formState: { errors } } = useForm<LoginForm>();
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const fillStaffCredentials = (email: string) => {
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

      const isStaff = res.memberships?.some(
        (m: any) => m.roleName === 'ADMIN' || m.roleName === 'SUPER_ADMIN',
      );

      if (!isStaff) {
        setServerError('This account belongs to a dealer or wholesaler. Please use the dealer/wholesaler login page.');
        return;
      }

      login(res);
      navigate('/admin/dashboard');
    } catch (err: any) {
      setServerError(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">{APP_NAME}</h1>
        <h2 className="mt-4 text-2xl font-bold text-gray-900">Platform staff sign in</h2>
        <p className="mt-1 text-sm text-gray-600">Super Admin and Admin only</p>
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
                Staff email
              </label>
              <input
                id="email"
                type="email"
                placeholder="admin@demo.test"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-gray-900 text-sm"
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
              <input
                id="password"
                type="password"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-gray-900 text-sm"
                {...register('password', { required: 'Password is required' })}
              />
              {errors.password && (
                <p className="mt-1 text-xs text-rose-600">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-gray-900 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 disabled:opacity-50 transition"
            >
              {loading ? 'Authenticating...' : 'Sign in as staff'}
            </button>
          </form>

          {/* Quick Staff Demo Fill Buttons */}
          <div className="mt-6 pt-5 border-t border-gray-100">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
              Staff Demo Accounts (Click to Fill)
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => fillStaffCredentials('admin@demo.test')}
                className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-md border border-gray-200 transition font-medium"
              >
                Platform Admin
              </button>
              <button
                type="button"
                onClick={() => fillStaffCredentials('superadmin@demo.test')}
                className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-md border border-gray-200 transition font-medium"
              >
                Super Admin
              </button>
            </div>
            <p className="text-[11px] text-gray-400 mt-2">
              Default password: <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-700 font-mono">Password123!</code>
            </p>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-100 text-center">
            <Link to="/login" className="text-xs text-gray-500 hover:text-gray-900">
              &larr; Return to dealer & wholesaler login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
