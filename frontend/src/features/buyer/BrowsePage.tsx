import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { formatMoney } from '../../lib/money';
import { useAuth } from '../../lib/auth';
import {
  Plus,
  Check,
  Search,
  Filter,
  ShieldAlert,
  ImageOff,
  X,
  ChevronDown,
  AlertCircle,
} from 'lucide-react';

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

const ProductImage: React.FC<{ src?: string; alt: string }> = ({ src, alt }) => {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-gray-400">
        <ImageOff className="w-7 h-7" aria-hidden="true" />
        <span className="text-xs">No image</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className="w-full h-full object-cover"
    />
  );
};

const FilterOption: React.FC<{
  name: string;
  label: string;
  checked: boolean;
  onChange: () => void;
}> = ({ name, label, checked, onChange }) => (
  <label className="flex items-center gap-2.5 py-1 text-sm text-gray-700 cursor-pointer">
    <input
      type="radio"
      name={name}
      checked={checked}
      onChange={onChange}
      className="text-indigo-600 focus:ring-indigo-500"
    />
    <span className={`truncate ${checked ? 'font-medium text-gray-900' : ''}`}>{label}</span>
  </label>
);

export const BrowsePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const search = searchParams.get('search') || '';
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedSeller, setSelectedSeller] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('price_asc');
  const [addedItem, setAddedItem] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'error' | 'warning'; text: string } | null>(null);
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
      setNotice({
        kind: 'warning',
        text: 'Your business account is pending approval. You cannot place orders until it is verified by an administrator.',
      });
      return;
    }

    try {
      setNotice(null);
      await api.post('/cart/items', {
        variantId,
        qty: minOrderQty || 1,
      });
      setAddedItem(variantId);
      setTimeout(() => setAddedItem(null), 2000);
    } catch (err: any) {
      setNotice({ kind: 'error', text: err.message || 'Failed to add item to cart' });
    }
  };

  const selectedCategoryName = categories.find((c) => c.id === selectedCategory)?.name;
  const selectedSellerName = sellers.find((s) => s.id === selectedSeller)?.name;
  const activeFilterCount = (selectedCategory ? 1 : 0) + (selectedSeller ? 1 : 0);

  const clearFilters = () => {
    setSelectedCategory('');
    setSelectedSeller('');
  };

  return (
    <div className="space-y-6">
      {isPendingApproval && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 text-amber-900">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-sm">
              Account verification pending ({activeOrg?.orgStatus || 'PENDING'})
            </h4>
            <p className="text-xs text-amber-700 mt-0.5">
              Your business registration documents are being reviewed. You can browse products now;
              adding to cart and placing orders unlock once you are approved.
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

      {/* Top Header & Sort */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Browse products</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {isLoading
              ? 'Loading products…'
              : `${sortedProducts.length} product${sortedProducts.length === 1 ? '' : 's'}`}
            {search && (
              <>
                {' '}
                for “<span className="font-medium text-gray-700">{search}</span>”
                {' · '}
                <Link to="/browse" className="text-indigo-600 hover:underline">
                  Clear search
                </Link>
              </>
            )}
            {!search && ' from verified wholesale sellers'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setFiltersOpen(!filtersOpen)}
            aria-expanded={filtersOpen}
            aria-controls="browse-filters"
            className="lg:hidden flex items-center gap-2 px-3 py-2 text-sm font-medium bg-white border border-gray-300 rounded-lg"
          >
            <Filter className="w-4 h-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-indigo-600 text-white text-[11px] font-semibold">
                {activeFilterCount}
              </span>
            )}
            <ChevronDown className={`w-4 h-4 ${filtersOpen ? 'rotate-180' : ''}`} />
          </button>

          <label htmlFor="sort-select" className="sr-only sm:not-sr-only text-sm text-gray-500 font-medium">
            Sort by
          </label>
          <select
            id="sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="flex-1 sm:flex-none text-sm bg-white border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
            <option value="name_asc">Name: A to Z</option>
          </select>
        </div>
      </div>

      {/* Active filter chips */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {selectedCategory && (
            <button
              onClick={() => setSelectedCategory('')}
              className="inline-flex items-center gap-1.5 pl-3 pr-2 py-1 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-full hover:bg-indigo-100"
            >
              {selectedCategoryName ?? 'Category'}
              <X className="w-3.5 h-3.5" aria-label="Remove category filter" />
            </button>
          )}
          {selectedSeller && (
            <button
              onClick={() => setSelectedSeller('')}
              className="inline-flex items-center gap-1.5 pl-3 pr-2 py-1 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-full hover:bg-indigo-100"
            >
              {selectedSellerName ?? 'Seller'}
              <X className="w-3.5 h-3.5" aria-label="Remove seller filter" />
            </button>
          )}
          <button onClick={clearFilters} className="text-xs font-medium text-gray-500 hover:text-gray-900 underline">
            Clear all
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-8">
        {/* Left Column: Filters (collapsible below lg) */}
        <aside id="browse-filters" className={`${filtersOpen ? 'block' : 'hidden'} lg:block`}>
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-5 lg:sticky lg:top-24">
            <div className="hidden lg:flex items-center gap-2 pb-3 border-b border-gray-100">
              <Filter className="w-4 h-4 text-gray-500" />
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Filters</h2>
            </div>

            {/* Categories filter */}
            <div role="radiogroup" aria-labelledby="filter-categories" className="min-w-0">
              <h3 id="filter-categories" className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Categories
              </h3>
              <div className="max-h-56 overflow-y-auto pr-1">
                <FilterOption
                  name="category"
                  label="All categories"
                  checked={selectedCategory === ''}
                  onChange={() => setSelectedCategory('')}
                />
                {categories.map((cat) => (
                  <FilterOption
                    key={cat.id}
                    name="category"
                    label={cat.name}
                    checked={selectedCategory === cat.id}
                    onChange={() => setSelectedCategory(cat.id)}
                  />
                ))}
              </div>
            </div>

            {/* Sellers filter */}
            {sellers.length > 0 && (
              <div role="radiogroup" aria-labelledby="filter-sellers" className="min-w-0 pt-4 border-t border-gray-100">
                <h3 id="filter-sellers" className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Sellers
                </h3>
                <div className="max-h-56 overflow-y-auto pr-1">
                  <FilterOption
                    name="seller"
                    label="All sellers"
                    checked={selectedSeller === ''}
                    onChange={() => setSelectedSeller('')}
                  />
                  {sellers.map((s) => (
                    <FilterOption
                      key={s.id}
                      name="seller"
                      label={s.name}
                      checked={selectedSeller === s.id}
                      onChange={() => setSelectedSeller(s.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Right Area: Product Grid */}
        <div className="lg:col-span-3">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
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
            <div className="bg-white p-10 sm:p-14 text-center rounded-xl border border-gray-200">
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                <Search className="w-6 h-6 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">No products found</h3>
              <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
                Try different filters or search for another keyword.
              </p>
              {(activeFilterCount > 0 || search) && (
                <div className="mt-5 flex items-center justify-center gap-3">
                  {activeFilterCount > 0 && (
                    <button
                      onClick={clearFilters}
                      className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
                    >
                      Clear filters
                    </button>
                  )}
                  {search && (
                    <Link
                      to="/browse"
                      className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg"
                    >
                      Clear search
                    </Link>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {sortedProducts.map((product) => {
                const primaryVariant = product.variants?.[0];
                const isOwnProduct = activeOrg?.orgId === product.sellerOrgId;
                const moq = primaryVariant?.minOrderQty ?? product.minOrderQty ?? 1;
                const unit = primaryVariant?.unit ?? 'units';

                return (
                  <div
                    key={product.id}
                    className="bg-white rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-md flex flex-col overflow-hidden"
                  >
                    <Link
                      to={`/products/${product.id}`}
                      aria-label={`View ${product.name}`}
                      className="block relative bg-gray-100 h-44 overflow-hidden"
                    >
                      <ProductImage src={product.imageUrl} alt={product.name} />
                      <span className="absolute top-2 left-2 px-2 py-0.5 bg-white/90 text-xs font-medium text-gray-700 rounded-md shadow-sm">
                        {product.categoryName}
                      </span>
                    </Link>

                    <div className="p-4 flex-1 flex flex-col">
                      <Link
                        to={`/products/${product.id}`}
                        title={product.name}
                        className="text-base font-semibold text-gray-900 hover:text-indigo-600 line-clamp-2 min-h-[3rem] leading-6"
                      >
                        {product.name}
                      </Link>

                      <p className="mt-1 text-xs text-gray-500 truncate" title={product.sellerName}>
                        Sold by {product.sellerName}
                      </p>

                      <div className="mt-3">
                        <div className="whitespace-nowrap">
                          <span className="text-lg font-bold text-gray-900">
                            {primaryVariant
                              ? formatMoney(primaryVariant.pricePaisa)
                              : product.pricePaisa !== undefined
                                ? formatMoney(product.pricePaisa)
                                : '—'}
                          </span>
                          <span className="text-xs text-gray-500 ml-1">/ {primaryVariant?.unit || 'unit'}</span>
                        </div>
                        <p className="mt-1.5 text-xs text-gray-500">
                          Min. order <span className="font-medium text-gray-700">{moq} {unit}</span>
                        </p>
                      </div>

                      {/* Add to Cart button */}
                      <div className="mt-auto pt-4">
                        {isOwnProduct ? (
                          <button
                            disabled
                            className="w-full py-2 px-3 text-xs font-semibold text-gray-400 bg-gray-100 rounded-lg cursor-not-allowed"
                          >
                            Your own product
                          </button>
                        ) : primaryVariant ? (
                          <button
                            onClick={() => handleAddToCart(primaryVariant.id, primaryVariant.minOrderQty)}
                            className={`w-full py-2 px-3 rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5 text-white ${
                              addedItem === primaryVariant.id
                                ? 'bg-emerald-600'
                                : 'bg-indigo-600 hover:bg-indigo-700'
                            }`}
                          >
                            {addedItem === primaryVariant.id ? (
                              <>
                                <Check className="w-4 h-4" />
                                <span>Added to cart</span>
                              </>
                            ) : (
                              <>
                                <Plus className="w-4 h-4" />
                                <span>Add to cart</span>
                              </>
                            )}
                          </button>
                        ) : (
                          <span className="block text-center text-xs text-gray-400">No active variants</span>
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
