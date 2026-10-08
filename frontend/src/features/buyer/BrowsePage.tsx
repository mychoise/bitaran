import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { formatMoney } from '../../lib/money';
import { useAuth } from '../../lib/auth';
import { Plus, Check, Search, Filter, ShieldAlert } from 'lucide-react';

interface ProductItem {
  id: string;
  name: string;
  description: string;
  categoryName: string;
  categoryId: string;
  sellerOrgId: string;
  sellerName: string;
  imageUrl?: string;
  pricePaisa?: number;
  minOrderQty?: number;
  variants?: Array<{
    id: string;
    sku: string;
    unit: string;
    packSize: number;
    pricePaisa: number;
    minOrderQty: number;
    qtyOnHand?: number;
    qtyReserved?: number;
  }>;
}

export const BrowsePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const search = searchParams.get('search') || '';
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedSeller, setSelectedSeller] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('price_asc');
  const [addedItem, setAddedItem] = useState<string | null>(null);
  const { activeOrg } = useAuth();
  const isPendingApproval = !!activeOrg && activeOrg.orgStatus !== 'APPROVED';

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<Array<{ id: string; name: string }>>('/catalog/categories'),
  });

  // Fetch products
  const { data: products = [], isLoading } = useQuery({
    queryKey: ['browse-products', selectedCategory, selectedSeller, search],
    queryFn: () =>
      api.get<ProductItem[]>('/catalog/products', {
        categoryId: selectedCategory || undefined,
        sellerOrgId: selectedSeller || undefined,
        search: search || undefined,
      }),
  });

  // Extract distinct sellers
  const sellers = Array.from(
    new Map(products.map((p) => [p.sellerOrgId, p.sellerName])).entries(),
  ).map(([id, name]) => ({ id, name }));

  // Sort products
  const sortedProducts = [...products].sort((a, b) => {
    const minPriceA =
      a.pricePaisa ??
      (a.variants && a.variants.length > 0
        ? Math.min(...a.variants.map((v) => v.pricePaisa))
        : 0);
    const minPriceB =
      b.pricePaisa ??
      (b.variants && b.variants.length > 0
        ? Math.min(...b.variants.map((v) => v.pricePaisa))
        : 0);
    if (sortBy === 'price_asc') return minPriceA - minPriceB;
    if (sortBy === 'price_desc') return minPriceB - minPriceA;
    return a.name.localeCompare(b.name);
  });

  const handleAddToCart = async (variantId: string, minOrderQty: number) => {
    if (isPendingApproval) {
      alert('Your business account is pending approval. You cannot place orders until verified by an administrator.');
      return;
    }

    try {
      await api.post('/cart/items', {
        variantId,
        qty: minOrderQty || 1,
      });
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
              Your business registration documents are currently being reviewed. You may browse product offerings, but adding items to cart and placing orders will be unlocked once approved.
            </p>
          </div>
        </div>
      )}

      {/* Top Header & Sort */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Browse products</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Wholesale bulk orders from certified verified sellers
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <label htmlFor="sort-select" className="text-sm text-gray-500 font-medium">
            Sort by:
          </label>
          <select
            id="sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="text-sm bg-white border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900"
          >
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
            <option value="name_asc">Name: A to Z</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Left Column: Filters */}
        <aside className="space-y-6">
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-5">
            <div className="flex items-center space-x-2 pb-3 border-b border-gray-100">
              <Filter className="w-4 h-4 text-gray-500" />
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Filters</h2>
            </div>

            {/* Categories filter */}
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2.5">
                Categories
              </h3>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                <label className="flex items-center space-x-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="radio"
                    name="category"
                    checked={selectedCategory === ''}
                    onChange={() => setSelectedCategory('')}
                    className="text-gray-900 focus:ring-gray-900"
                  />
                  <span>All categories</span>
                </label>
                {categories.map((cat) => (
                  <label
                    key={cat.id}
                    className="flex items-center space-x-2 text-sm text-gray-700 cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="category"
                      checked={selectedCategory === cat.id}
                      onChange={() => setSelectedCategory(cat.id)}
                      className="text-gray-900 focus:ring-gray-900"
                    />
                    <span>{cat.name}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Sellers filter */}
            {sellers.length > 0 && (
              <div className="pt-4 border-t border-gray-100">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2.5">
                  Sellers
                </h3>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  <label className="flex items-center space-x-2 text-sm text-gray-700 cursor-pointer">
                    <input
                      type="radio"
                      name="seller"
                      checked={selectedSeller === ''}
                      onChange={() => setSelectedSeller('')}
                      className="text-gray-900 focus:ring-gray-900"
                    />
                    <span>All sellers</span>
                  </label>
                  {sellers.map((s) => (
                    <label
                      key={s.id}
                      className="flex items-center space-x-2 text-sm text-gray-700 cursor-pointer"
                    >
                      <input
                        type="radio"
                        name="seller"
                        checked={selectedSeller === s.id}
                        onChange={() => setSelectedSeller(s.id)}
                        className="text-gray-900 focus:ring-gray-900"
                      />
                      <span className="truncate">{s.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Right Area: 3-column Product Grid */}
        <div className="lg:col-span-3">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div key={n} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
                  <div className="w-full h-44 bg-gray-200 rounded-lg mb-4" />
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                  <div className="h-4 bg-gray-200 rounded w-1/2 mb-4" />
                  <div className="h-10 bg-gray-200 rounded" />
                </div>
              ))}
            </div>
          ) : sortedProducts.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-xl border border-gray-200">
              <Search className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-gray-900">No products found</h3>
              <p className="text-sm text-gray-500 mt-1">
                Try selecting different filters or searching for other keywords.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {sortedProducts.map((product) => {
                const primaryVariant = product.variants?.[0];
                const isOwnProduct = activeOrg?.orgId === product.sellerOrgId;

                return (
                  <div
                    key={product.id}
                    className="bg-white rounded-xl border border-gray-200 hover:shadow-md transition flex flex-col overflow-hidden"
                  >
                    {/* Image placeholder / thumbnail */}
                    <Link to={`/products/${product.id}`} className="block relative bg-gray-100 h-44 overflow-hidden">
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="w-full h-full object-cover hover:scale-105 transition duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
                          Product image
                        </div>
                      )}
                      <span className="absolute top-2 left-2 px-2 py-0.5 bg-white/90 backdrop-blur-sm text-xs font-medium text-gray-700 rounded-md shadow-xs">
                        {product.categoryName}
                      </span>
                    </Link>

                    {/* Content */}
                    <div className="p-4 flex-1 flex flex-col justify-between">
                      <div>
                        <Link
                          to={`/products/${product.id}`}
                          className="text-base font-semibold text-gray-900 hover:text-indigo-600 transition line-clamp-1"
                        >
                          {product.name}
                        </Link>

                        <div className="mt-1 text-xs text-gray-500">
                          {product.sellerName} · Min order {primaryVariant?.minOrderQty ?? product.minOrderQty ?? 1} {primaryVariant?.unit ?? 'units'}
                        </div>

                        <div className="mt-3">
                          <span className="text-lg font-bold text-gray-900">
                            {primaryVariant ? formatMoney(primaryVariant.pricePaisa) : (product.pricePaisa !== undefined ? formatMoney(product.pricePaisa) : '—')}
                          </span>
                          <span className="text-xs text-gray-500 ml-1">
                            / {primaryVariant?.unit || 'unit'}
                          </span>
                        </div>
                      </div>

                      {/* Add to Cart button */}
                      <div className="mt-4 pt-3 border-t border-gray-100">
                        {isOwnProduct ? (
                          <button
                            disabled
                            className="w-full py-2 px-3 text-xs font-semibold text-gray-400 bg-gray-100 rounded-lg cursor-not-allowed"
                          >
                            Your own product
                          </button>
                        ) : primaryVariant ? (
                          <button
                            onClick={() =>
                              handleAddToCart(primaryVariant.id, primaryVariant.minOrderQty)
                            }
                            className={`w-full py-2 px-3 rounded-lg text-sm font-semibold flex items-center justify-center space-x-1.5 transition ${
                              addedItem === primaryVariant.id
                                ? 'bg-emerald-600 text-white'
                                : 'bg-gray-900 hover:bg-gray-800 text-white'
                            }`}
                          >
                            {addedItem === primaryVariant.id ? (
                              <>
                                <Check className="w-4 h-4" />
                                <span>Added</span>
                              </>
                            ) : (
                              <>
                                <Plus className="w-4 h-4" />
                                <span>Add to cart</span>
                              </>
                            )}
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">No active variants</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
