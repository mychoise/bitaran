import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { formatMoney } from '../../lib/money';
import { useAuth } from '../../lib/auth';
import { ArrowLeft, Check, Plus, Store, Tag, ShieldAlert } from 'lucide-react';

export const ProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { activeOrg } = useAuth();
  const isPendingApproval = !!activeOrg && activeOrg.orgStatus !== 'APPROVED';
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [addedItem, setAddedItem] = useState<string | null>(null);

  const { data: product, isLoading, error } = useQuery({
    queryKey: ['product', id],
    queryFn: () => api.get<any>(`/catalog/products/${id}`),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 animate-pulse space-y-6">
        <div className="h-6 bg-gray-200 w-1/4 rounded" />
        <div className="h-8 bg-gray-200 w-1/2 rounded" />
        <div className="h-32 bg-gray-200 rounded" />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <h2 className="text-lg font-bold text-gray-900">Product not found</h2>
        <Link to="/browse" className="mt-4 inline-block text-sm text-indigo-600 hover:underline">
          &larr; Back to browse
        </Link>
      </div>
    );
  }

  const isOwnProduct = activeOrg?.orgId === product.sellerOrgId;

  const handleQtyChange = (variantId: string, val: number, moq: number) => {
    setQuantities((prev) => ({
      ...prev,
      [variantId]: Math.max(moq, val),
    }));
  };

  const handleAddToCart = async (variantId: string, minOrderQty: number) => {
    if (isPendingApproval) {
      alert('Your business account is pending approval. You cannot place orders until verified by an administrator.');
      return;
    }

    const qty = quantities[variantId] ?? minOrderQty;
    try {
      await api.post('/cart/items', { variantId, qty });
      setAddedItem(variantId);
      setTimeout(() => setAddedItem(null), 2000);
    } catch (err: any) {
      alert(err.message || 'Failed to add item to cart');
    }
  };

  return (
    <div className="space-y-6">
      {isPendingApproval && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start space-x-3 text-amber-900">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-sm">Account Verification Pending ({activeOrg?.orgStatus || 'PENDING'})</h4>
            <p className="text-xs text-amber-700 mt-0.5">
              Your business registration documents are currently being reviewed. You may view product details, but adding items to cart and placing orders will be unlocked once approved.
            </p>
          </div>
        </div>
      )}

      <Link
        to="/browse"
        className="inline-flex items-center space-x-1.5 text-sm font-medium text-gray-500 hover:text-gray-900 transition"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to browse</span>
      </Link>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 p-6 lg:p-8">
          {/* Product Image */}
          <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden border border-gray-200 flex items-center justify-center">
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="text-gray-400 text-sm">Product image</div>
            )}
          </div>

          {/* Product Details Header */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-md">
                <Tag className="w-3 h-3" />
                <span>{product.categoryName}</span>
              </span>
              <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 text-xs font-medium rounded-md">
                <Store className="w-3 h-3" />
                <span>{product.sellerName}</span>
              </span>
            </div>

            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{product.name}</h1>

            <div className="text-sm text-gray-600 leading-relaxed pt-2 border-t border-gray-100">
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                Description
              </h2>
              <p>{product.description || 'No description provided by the seller.'}</p>
            </div>

            {isOwnProduct && (
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg font-medium">
                Note: This product is listed by your own organization. Self-purchasing is disabled.
              </div>
            )}
          </div>
        </div>

        {/* Variants Table */}
        <div className="border-t border-gray-200 p-6 lg:p-8">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Available Variants & Bulk Tiers</h2>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">SKU</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Unit</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Pack size</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Price (per unit)</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Min Order</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700">Quantity</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {product.variants?.map((v: any) => {
                  const qty = quantities[v.id] ?? v.minOrderQty;

                  return (
                    <tr key={v.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3 font-mono text-xs text-gray-900 font-semibold">
                        {v.sku}
                      </td>
                      <td className="px-4 py-3 text-gray-600 capitalize">{v.unit}</td>
                      <td className="px-4 py-3 text-gray-600">{v.packSize}</td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900">
                        {formatMoney(v.pricePaisa)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600 font-medium">
                        {v.minOrderQty}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="number"
                          min={v.minOrderQty}
                          value={qty}
                          disabled={isOwnProduct}
                          onChange={(e) =>
                            handleQtyChange(v.id, parseInt(e.target.value, 10) || v.minOrderQty, v.minOrderQty)
                          }
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-center text-sm focus:outline-none focus:ring-1 focus:ring-gray-900 disabled:bg-gray-100"
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isOwnProduct ? (
                          <span className="text-xs text-gray-400">Own item</span>
                        ) : (
                          <button
                            onClick={() => handleAddToCart(v.id, v.minOrderQty)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center space-x-1 transition ${
                              addedItem === v.id
                                ? 'bg-emerald-600 text-white'
                                : 'bg-gray-900 hover:bg-gray-800 text-white'
                            }`}
                          >
                            {addedItem === v.id ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>Added</span>
                              </>
                            ) : (
                              <>
                                <Plus className="w-3.5 h-3.5" />
                                <span>Add</span>
                              </>
                            )}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
