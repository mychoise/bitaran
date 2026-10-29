import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { rupeesToPaisa, paisaToRupees } from '../../lib/money';
import { useAuth } from '../../lib/auth';
import { Plus, Trash2, ArrowLeft, Save, ShieldAlert } from 'lucide-react';

interface VariantInput {
  id?: string;
  sku: string;
  unit: string;
  packSize: number;
  priceRs: string;
  minOrderQty: number;
}

export const ProductFormPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { activeOrg } = useAuth();
  const isApproved = activeOrg?.orgStatus === 'APPROVED';

  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [status, setStatus] = useState<'DRAFT' | 'ACTIVE'>('ACTIVE');
  const [variants, setVariants] = useState<VariantInput[]>([
    { sku: '', unit: 'piece', packSize: 1, priceRs: '1000', minOrderQty: 1 },
  ]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<any[]>('/catalog/categories'),
  });

  // If edit, fetch existing product
  const { data: existingProduct } = useQuery({
    queryKey: ['product', id],
    queryFn: () => api.get<any>(`/catalog/products/${id}`),
    enabled: isEdit,
  });

  useEffect(() => {
    if (existingProduct) {
      setName(existingProduct.name || '');
      setCategoryId(existingProduct.categoryId || '');
      setDescription(existingProduct.description || '');
      setImageUrl(existingProduct.imageUrl || '');
      setStatus(existingProduct.status === 'DRAFT' ? 'DRAFT' : 'ACTIVE');

      if (existingProduct.variants && existingProduct.variants.length > 0) {
        setVariants(
          existingProduct.variants.map((v: any) => ({
            id: v.id,
            sku: v.sku,
            unit: v.unit,
            packSize: v.packSize,
            priceRs: paisaToRupees(v.pricePaisa),
            minOrderQty: v.minOrderQty,
          })),
        );
      }
    }
  }, [existingProduct]);

  const addVariantRow = () => {
    setVariants((prev) => [
      ...prev,
      { sku: '', unit: 'carton', packSize: 10, priceRs: '1000', minOrderQty: 1 },
    ]);
  };

  const removeVariantRow = (idx: number) => {
    if (variants.length <= 1) return;
    setVariants((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateVariantRow = (idx: number, field: keyof VariantInput, value: any) => {
    setVariants((prev) =>
      prev.map((v, i) => (i === idx ? { ...v, [field]: value } : v)),
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!isApproved) {
      setErrorMsg(
        'Your business account is pending approval by platform staff. You cannot list or edit products until approved.',
      );
      return;
    }

    if (!name.trim()) {
      setErrorMsg('Product name is required');
      return;
    }

    if (variants.some((v) => !v.sku.trim())) {
      setErrorMsg('Every variant must have an SKU specified.');
      return;
    }

    try {
      setSaving(true);

      const payload = {
        name,
        categoryId: categoryId || undefined,
        description,
        imageUrl: imageUrl || undefined,
        status,
        variants: variants.map((v) => ({
          sku: v.sku.trim(),
          unit: v.unit.trim(),
          packSize: Number(v.packSize) || 1,
          pricePaisa: rupeesToPaisa(v.priceRs),
          minOrderQty: Number(v.minOrderQty) || 1,
        })),
      };

      if (isEdit) {
        await api.put(`/catalog/products/${id}`, payload);
      } else {
        await api.post('/catalog/products', payload);
      }

      queryClient.invalidateQueries({ queryKey: ['seller-products'] });
      navigate('/seller/products');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Link
        to="/seller/products"
        className="inline-flex items-center space-x-1.5 text-sm font-medium text-gray-500 hover:text-gray-900 transition"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to products</span>
      </Link>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 lg:p-8 max-w-4xl">
        <h1 className="text-xl font-bold text-gray-900 border-b border-gray-100 pb-3">
          {isEdit ? 'Edit Product' : 'Add New Product'}
        </h1>

        {!isApproved && (
          <div className="mt-4 p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl flex items-start space-x-3">
            <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-bold">Business Approval Pending</p>
              <p className="mt-0.5 text-amber-800">
                Your business account status is <strong>{activeOrg?.orgStatus || 'PENDING'}</strong>. Platform administrators must review and approve your KYC documents before you can publish or edit products on the marketplace.
              </p>
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Product Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Basmati Rice 25kg Sack"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Category
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">Select a category</option>
                {categories.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide wholesale specifications, packaging notes, storage instructions..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 min-h-[80px]"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Image URL
              </label>
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://images.unsplash.com/..."
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Listing Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'DRAFT' | 'ACTIVE')}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="ACTIVE">Active (Available for purchase)</option>
                <option value="DRAFT">Draft (Hidden)</option>
              </select>
            </div>
          </div>

          {/* Variants Table */}
          <div className="pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-bold text-gray-900">Product Variants & Bulk Pricing</h2>
                <p className="text-xs text-gray-500">
                  Define units, pack sizes, MOQ and price in Nepali Rupees (Rs)
                </p>
              </div>

              <button
                type="button"
                onClick={addVariantRow}
                className="inline-flex items-center space-x-1 px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add variant</span>
              </button>
            </div>

            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="min-w-full divide-y divide-gray-200 text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-700">SKU *</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-700">Unit (piece/carton/bag)</th>
                    <th className="px-3 py-2.5 text-center font-semibold text-gray-700">Pack size</th>
                    <th className="px-3 py-2.5 text-right font-semibold text-gray-700">Price (Rs) *</th>
                    <th className="px-3 py-2.5 text-center font-semibold text-gray-700">Min Order (MOQ)</th>
                    <th className="px-3 py-2.5 text-center font-semibold text-gray-700"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {variants.map((v, idx) => (
                    <tr key={idx}>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={v.sku}
                          onChange={(e) => updateVariantRow(idx, 'sku', e.target.value)}
                          placeholder="e.g. RICE-25KG"
                          className="w-full px-2 py-1 border border-gray-300 rounded font-mono text-xs focus:ring-1 focus:ring-indigo-500"
                          required
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={v.unit}
                          onChange={(e) => updateVariantRow(idx, 'unit', e.target.value)}
                          placeholder="piece, sack, carton..."
                          className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-indigo-500"
                          required
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="number"
                          min={1}
                          value={v.packSize}
                          onChange={(e) =>
                            updateVariantRow(idx, 'packSize', parseInt(e.target.value, 10) || 1)
                          }
                          className="w-16 px-2 py-1 border border-gray-300 rounded text-center text-xs"
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="relative inline-block w-28">
                          <span className="absolute left-2 top-1.5 text-gray-400 text-xs">Rs</span>
                          <input
                            type="text"
                            value={v.priceRs}
                            onChange={(e) => updateVariantRow(idx, 'priceRs', e.target.value)}
                            className="w-full pl-7 pr-2 py-1 border border-gray-300 rounded text-right text-xs font-semibold"
                            required
                          />
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="number"
                          min={1}
                          value={v.minOrderQty}
                          onChange={(e) =>
                            updateVariantRow(idx, 'minOrderQty', parseInt(e.target.value, 10) || 1)
                          }
                          className="w-16 px-2 py-1 border border-gray-300 rounded text-center text-xs"
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        {variants.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeVariantRow(idx)}
                            className="text-gray-400 hover:text-rose-600 p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Form Actions */}
          <div className="pt-4 border-t border-gray-100 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={() => navigate('/seller/products')}
              className="px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving || !isApproved}
              className="inline-flex items-center space-x-1.5 px-5 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : !isApproved ? 'Pending Approval' : 'Save product'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
