import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { APP_NAME } from '../../config/app.config';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';

interface RegisterForm {
  name: string;
  phone: string;
  email: string;
  password: string;
  businessName: string;
  panNumber: string;
  canBuy: boolean;
  canSell: boolean;
  documentFileName?: string;
}

export const RegisterPage: React.FC = () => {
  const { register, handleSubmit, formState: { errors } } = useForm<RegisterForm>({
    defaultValues: {
      canBuy: true,
      canSell: false,
    },
  });

  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [docName, setDocName] = useState<string>('');
  const [docData, setDocData] = useState<string>('');
  const [docType, setDocType] = useState<string>('');
  const [docPreview, setDocPreview] = useState<string | null>(null);
  const { login } = useAuth();
  const navigate = useNavigate();

  const compressImageIfNeeded = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      if (!file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const maxDim = 1600;
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressed = canvas.toDataURL('image/jpeg', 0.85);
            resolve(compressed);
          } else {
            resolve(e.target?.result as string);
          }
        };
        img.onerror = () => resolve(e.target?.result as string);
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setDocName(file.name);
      setDocType(file.type || 'image/jpeg');
      try {
        const dataUrl = await compressImageIfNeeded(file);
        setDocData(dataUrl);
        if (file.type.startsWith('image/')) {
          setDocPreview(dataUrl);
        } else {
          setDocPreview(null);
        }
      } catch {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          setDocData(result);
          if (file.type.startsWith('image/')) {
            setDocPreview(result);
          }
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const onSubmit = async (data: RegisterForm) => {
    if (!data.canBuy && !data.canSell) {
      setServerError('Please select at least one activity: Buy products or Sell products');
      return;
    }

    try {
      setLoading(true);
      setServerError(null);
      const res = await api.post<any>('/auth/register', {
        ...data,
        documentFileName: docName || 'business_registration.pdf',
        documentData: docData || undefined,
        documentMimeType: docType || 'image/jpeg',
      });

      login(res);
      navigate(data.canSell ? '/seller/dashboard' : '/browse');
    } catch (err: any) {
      setServerError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-xl text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">{APP_NAME}</h1>
        <h2 className="mt-4 text-2xl font-bold text-gray-900">Register your business</h2>
        <p className="mt-1 text-sm text-gray-600">Join the B2B wholesale marketplace</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="bg-white py-8 px-6 shadow-sm rounded-xl border border-gray-200 sm:px-10">
          {serverError && (
            <div className="mb-6 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg">
              {serverError}
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                  Your full name
                </label>
                <input
                  id="name"
                  type="text"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  {...register('name', { required: 'Name is required' })}
                />
                {errors.name && (
                  <p className="mt-1 text-xs text-rose-600">{errors.name.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                  Phone number
                </label>
                <input
                  id="phone"
                  type="text"
                  placeholder="98XXXXXXXX"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  {...register('phone', { required: 'Phone is required' })}
                />
                {errors.phone && (
                  <p className="mt-1 text-xs text-rose-600">{errors.phone.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
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
                <input
                  id="password"
                  type="password"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  {...register('password', {
                    required: 'Password is required',
                    minLength: { value: 6, message: 'Minimum 6 characters' },
                  })}
                />
                {errors.password && (
                  <p className="mt-1 text-xs text-rose-600">{errors.password.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-gray-100">
              <div>
                <label htmlFor="businessName" className="block text-sm font-medium text-gray-700">
                  Business / Company name
                </label>
                <input
                  id="businessName"
                  type="text"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  {...register('businessName', { required: 'Business name is required' })}
                />
                {errors.businessName && (
                  <p className="mt-1 text-xs text-rose-600">{errors.businessName.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="panNumber" className="block text-sm font-medium text-gray-700">
                  PAN number
                </label>
                <input
                  id="panNumber"
                  type="text"
                  placeholder="9-digit PAN"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  {...register('panNumber', { required: 'PAN is required' })}
                />
                {errors.panNumber && (
                  <p className="mt-1 text-xs text-rose-600">{errors.panNumber.message}</p>
                )}
              </div>
            </div>

            {/* Checkboxes: Buy and Sell */}
            <div className="pt-2">
              <span className="block text-sm font-medium text-gray-700 mb-2">
                Business activities
              </span>
              <div className="flex space-x-6">
                <label className="flex items-center space-x-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    {...register('canBuy')}
                  />
                  <span>Buy products (Dealer)</span>
                </label>
                <label className="flex items-center space-x-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    {...register('canSell')}
                  />
                  <span>Sell products (Wholesaler)</span>
                </label>
              </div>
            </div>

            {/* Business documents */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Business documents (PAN / Registration certificate)
              </label>
              <p className="text-xs text-gray-500 mb-2">Select an image or PDF document to attach with your application.</p>
              <input
                type="file"
                accept="image/*,.pdf"
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                onChange={handleFileChange}
              />
              {docName && (
                <div className="mt-2 flex items-center space-x-3 p-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                  {docPreview ? (
                    <img
                      src={docPreview}
                      alt="Document thumbnail"
                      className="w-12 h-12 object-cover rounded border border-emerald-300"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs rounded">
                      FILE
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-emerald-800 font-semibold truncate max-w-xs">{docName}</p>
                    <p className="text-[11px] text-emerald-600">Attached and ready for review</p>
                  </div>
                </div>
              )}
            </div>

            {/* Review notice */}
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg">
              <span className="font-semibold">Review Notice:</span> An administrator reviews all business accounts before ordering or product listing is enabled.
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition"
            >
              {loading ? 'Submitting...' : 'Submit for approval'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-600">
            Already registered?{' '}
            <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
              Sign in to your account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
