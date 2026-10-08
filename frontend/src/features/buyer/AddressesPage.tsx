import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { api } from '../../lib/api';
import { MapPin, Trash2, CheckCircle2 } from 'lucide-react';

interface AddressForm {
  label: string;
  line1: string;
  city: string;
  district: string;
  province?: string;
  phone: string;
  isDefault: boolean;
}

export const AddressesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset } = useForm<AddressForm>({
    defaultValues: {
      label: 'Main Mart',
      city: 'Kathmandu',
      district: 'Kathmandu',
      province: 'Bagmati',
      isDefault: true,
    },
  });

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: addresses = [], isLoading } = useQuery({
    queryKey: ['addresses'],
    queryFn: () => api.get<any[]>('/orgs/addresses'),
  });

  const addMutation = useMutation({
    mutationFn: (data: AddressForm) => api.post('/orgs/addresses', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['addresses'] });
      reset();
      setSaving(false);
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Failed to save address');
      setSaving(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/orgs/addresses/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['addresses'] });
    },
  });

  const onSubmit = (data: AddressForm) => {
    setSaving(true);
    setErrorMsg(null);
    addMutation.mutate(data);
  };

  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-gray-200">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Delivery Addresses</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Manage shipping and drop-off destinations for your business
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: List of Address Cards */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Saved Addresses</h2>

          {isLoading ? (
            <div className="p-8 text-center text-gray-400">Loading addresses...</div>
          ) : addresses.length === 0 ? (
            <div className="bg-white p-8 rounded-xl border border-gray-200 text-center">
              <MapPin className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600">No addresses saved yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {addresses.map((addr: any) => (
                <div
                  key={addr.id}
                  className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-sm text-gray-900">{addr.label || 'Address'}</span>
                      {addr.isDefault && (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold rounded-full">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Default</span>
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 font-medium">{addr.line1}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {addr.city}, {addr.district || ''} {addr.province ? `(${addr.province})` : ''}
                    </p>
                    {addr.phone && (
                      <p className="text-xs text-gray-500 mt-2 font-mono">Phone: {addr.phone}</p>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-100 flex justify-end">
                    <button
                      onClick={() => {
                        if (confirm('Delete this address?')) {
                          deleteMutation.mutate(addr.id);
                        }
                      }}
                      className="text-gray-400 hover:text-rose-600 text-xs font-medium flex items-center space-x-1 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right 1 Col: Add Address Form Card */}
        <div className="space-y-4">
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide border-b border-gray-100 pb-2">
              Add New Address
            </h2>

            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
                {errorMsg}
              </div>
            )}

            <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
              <div>
                <label className="block text-xs font-medium text-gray-700">Label (e.g. Main Outlet)</label>
                <input
                  type="text"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-gray-900"
                  {...register('label', { required: 'Label is required' })}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700">Street / Area</label>
                <input
                  type="text"
                  placeholder="Street, Ward, Landmark"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-gray-900"
                  {...register('line1', { required: 'Street line is required' })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700">City</label>
                  <input
                    type="text"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-gray-900"
                    {...register('city', { required: 'City is required' })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700">District</label>
                  <input
                    type="text"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-gray-900"
                    {...register('district', { required: 'District is required' })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700">Phone</label>
                <input
                  type="text"
                  placeholder="98XXXXXXXX"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-gray-900"
                  {...register('phone', { required: 'Contact phone is required' })}
                />
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="isDefault"
                  className="rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                  {...register('isDefault')}
                />
                <label htmlFor="isDefault" className="text-xs text-gray-700 cursor-pointer">
                  Set as default delivery address
                </label>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-2.5 px-4 rounded-lg bg-gray-900 hover:bg-gray-800 text-white font-semibold text-sm shadow-sm transition disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save address'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
