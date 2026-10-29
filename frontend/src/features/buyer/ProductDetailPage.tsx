import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { formatMoney } from '../../lib/money';
import { useAuth } from '../../lib/auth';
import { ArrowLeft, Check, Plus, Store, Tag, ShieldAlert, ImageOff, AlertCircle, X } from 'lucide-react';

export const ProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { activeOrg } = useAuth();
  const isPendingApproval = !!activeOrg && activeOrg.orgStatus !== 'APPROVED';
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [addedItem, setAddedItem] = useState<string | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'error' | 'warning'; text: string } | null>(null);

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
      setNotice({
        kind: 'warning',
        text: 'Your business account is pending approval. You cannot place orders until it is verified by an administrator.',
      });
      return;
    }

    const qty = quantities[variantId] ?? minOrderQty;
    try {
      setNotice(null);
      await api.post('/cart/items', { variantId, qty });
      setAddedItem(variantId);
      setTimeout(() => setAddedItem(null), 2000);
    } catch (err: any) {
      setNotice({ kind: 'error', text: err.message || 'Failed to add item to cart' });
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

      {notice && (
        <div
          role="alert"
          className={`p-3 pr-2 rounded-xl border flex items-start gap-3 text-sm ${
            notice.kind === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}
        >
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
          <p className="flex-1">{notice.text}</p>
          <button
            onClick={() => setNotice(null)}
            aria-label="Dismiss message"
            className="p-1.5 rounded-lg hover:bg-black/5"
          >
            <X className="w-4 h-4" />
          </button>
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
            {product.imageUrl && !imageFailed ? (
              <img
                src={product.imageUrl}
                alt={product.name}
                onError={() => setImageFailed(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center gap-1 text-gray-400">
                <ImageOff className="w-8 h-8" aria-hidden="true" />
                <span className="text-sm">No image</span>
              </div>
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
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Availability</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700">Quantity</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {product.variants?.map((v: any) => {
                  const qty = quantities[v.id] ?? v.minOrderQty;
                  const available =
                    typeof v.qtyOnHand === 'number' ? v.qtyOnHand - (v.qtyReserved ?? 0) : null;
                  const outOfStock = available !== null && available <= 0;

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
                      <td className="px-4 py-3 whitespace-nowrap">
                        {available === null ? (
                          <span className="text-gray-400">—</span>
                        ) : available <= 0 ? (
                          <span className="text-xs font-medium text-rose-600">Out of stock</span>
                        ) : available < v.minOrderQty * 3 ? (
                          <span className="text-xs font-medium text-amber-600">Only {available} left</span>
                        ) : (
                          <span className="text-xs font-medium text-emerald-600">In stock</span>
                        )}
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
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-center text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-100"
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isOwnProduct ? (
                          <span className="text-xs text-gray-400">Own item</span>
                        ) : (
                          <button
                            onClick={() => handleAddToCart(v.id, v.minOrderQty)}
                            disabled={outOfStock}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center space-x-1 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed ${
                              addedItem === v.id
                                ? 'bg-emerald-600 text-white'
                                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
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
