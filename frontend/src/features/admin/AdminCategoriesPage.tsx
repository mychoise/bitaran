import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { notifyError } from '../../lib/notify';
import { Trash2, FolderTree } from 'lucide-react';

export const AdminCategoriesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<any[]>('/admin/categories'),
  });

  const saveMutation = useMutation({
    mutationFn: (payload: { name: string; parentId?: string }) => {
      if (editId) {
        return api.put(`/admin/categories/${editId}`, payload);
      }
      return api.post('/admin/categories', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setName('');
      setParentId('');
      setEditId(null);
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Operation failed');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/categories/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
    onError: (err: any) => {
      notifyError(err.message || 'Cannot delete category in use');
    },
  });

  const handleEdit = (cat: any) => {
    setEditId(cat.id);
    setName(cat.name);
    setParentId(cat.parentId || '');
  };

  const handleCancel = () => {
    setEditId(null);
    setName('');
    setParentId('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setErrorMsg(null);
    saveMutation.mutate({ name: name.trim(), parentId: parentId || undefined });
  };

  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-gray-200">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Product Categories</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Manage product hierarchy and wholesale classification taxonomy
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Categories Table */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
              All Categories
            </h2>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-gray-400">Loading categories...</div>
          ) : categories.length === 0 ? (
            <div className="p-12 text-center text-gray-500 text-sm">No categories created yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left font-semibold text-gray-700">Category</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-700">Parent</th>
                    <th className="px-6 py-3 text-right font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {categories.map((cat: any) => {
                    const parent = categories.find((c: any) => c.id === cat.parentId);

                    return (
                      <tr key={cat.id} className="hover:bg-gray-50 transition">
                        <td className="px-6 py-3.5 font-semibold text-gray-900 flex items-center space-x-2">
                          <FolderTree className="w-4 h-4 text-gray-400" />
                          <span>{cat.name}</span>
                        </td>
                        <td className="px-6 py-3.5 text-gray-500 text-xs">
                          {parent ? parent.name : '— (Root)'}
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          <div className="flex items-center justify-end space-x-3">
                            <button
                              onClick={() => handleEdit(cat)}
                              className="text-gray-500 hover:text-indigo-600 text-xs font-semibold"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Delete category "${cat.name}"?`)) {
                                  deleteMutation.mutate(cat.id);
                                }
                              }}
                              className="text-gray-400 hover:text-rose-600 text-xs"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right 1 Col: Add / Edit Card */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide border-b border-gray-100 pb-2">
            {editId ? 'Edit Category' : 'Add Category'}
          </h2>

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700">Category Name *</label>
              <input
                type="text"
                placeholder="e.g. Edible Oils & Spices"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700">Parent Category</label>
              <select
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">None (Top-level)</option>
                {categories
                  .filter((c: any) => c.id !== editId)
                  .map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex items-center space-x-2 pt-2">
              {editId && (
                <button
                  type="button"
                  onClick={handleCancel}
                  className="w-1/2 py-2 px-3 bg-gray-100 text-gray-700 font-semibold text-xs rounded-lg hover:bg-gray-200 transition"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={saveMutation.isPending}
                className={`py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg transition disabled:opacity-50 ${
                  editId ? 'w-1/2' : 'w-full'
                }`}
              >
                {saveMutation.isPending ? 'Saving...' : editId ? 'Update' : 'Save Category'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
