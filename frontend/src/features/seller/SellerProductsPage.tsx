import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { StatusBadge } from '../../components/StatusBadge';
import { Plus, Edit, Boxes, ShieldAlert, ImageOff } from 'lucide-react';
import { useAuth } from '../../lib/auth';

export const SellerProductsPage: React.FC = () => {
  const { activeOrg } = useAuth();
  const isApproved = activeOrg?.orgStatus === 'APPROVED';

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['seller-products', activeOrg?.orgId],
    queryFn: () => api.get<any[]>('/catalog/products/seller'),
    enabled: !!activeOrg?.canSell && isApproved,
  });

  return (
    <div className="space-y-6">
      {!isApproved && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start space-x-3 text-amber-900">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-sm">Account Verification Required</h4>
            <p className="text-xs text-amber-700 mt-0.5">
              Your business application is currently in <strong>{activeOrg?.orgStatus || 'PENDING'}</strong> review. An administrator must verify your business registration and PAN documents before you can add products or sell on Bitaran.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Products</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage your catalog, SKUs, pricing and pack sizes for bulk wholesale
          </p>
        </div>

        {isApproved ? (
          <Link
            to="/seller/products/new"
            className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-lg text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add product</span>
          </Link>
        ) : (
          <button
            disabled
            className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-lg text-sm font-bold text-gray-400 bg-gray-100 cursor-not-allowed border border-gray-200"
            title="Approval required to list products"
          >
            <Plus className="w-4 h-4" />
            <span>Add product (Locked)</span>
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading products...</div>
        ) : products.length === 0 ? (
          <div className="p-12 text-center">
            <Boxes className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-gray-900">No products added yet</h3>
            <p className="text-sm text-gray-500 mt-1">
              {isApproved
                ? 'Start by listing your bulk items and inventory variants.'
                : 'Listing will become available once your business account is approved.'}
            </p>
            {isApproved && (
              <Link
                to="/seller/products/new"
                className="mt-4 inline-flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add your first product</span>
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3.5 text-left font-semibold text-gray-700">Product</th>
                  <th className="px-6 py-3.5 text-left font-semibold text-gray-700">Category</th>
                  <th className="px-6 py-3.5 text-center font-semibold text-gray-700">Variants</th>
                  <th className="px-6 py-3.5 text-center font-semibold text-gray-700">Status</th>
                  <th className="px-6 py-3.5 text-right font-semibold text-gray-700">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {products.map((prod: any) => (
                  <tr key={prod.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-lg overflow-hidden border border-gray-200 flex-shrink-0">
                          {prod.imageUrl ? (
                            <img
                              src={prod.imageUrl}
                              alt={prod.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-300">
                              <ImageOff className="w-4 h-4" aria-hidden="true" />
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{prod.name}</p>
                          <p className="text-xs text-gray-500 line-clamp-1">{prod.description}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{prod.categoryName || 'Unassigned'}</td>
                    <td className="px-6 py-4 text-center font-semibold text-gray-900">
                      {prod.variants?.length ?? 1}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <StatusBadge status={prod.status} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        to={`/seller/products/${prod.id}/edit`}
                        className="inline-flex items-center space-x-1 text-xs font-bold text-indigo-600 hover:text-indigo-800"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
