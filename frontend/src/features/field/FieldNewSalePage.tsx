import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { formatMoney } from '../../lib/money';
import { useAuth } from '../../lib/auth';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  X,
  CreditCard,
  Banknote,
  Wallet,
  Smartphone,
  ShoppingCart,
  Receipt,
  User,
} from 'lucide-react';

interface ProductVariant {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  unit: string;
  packSize: number;
  pricePaisa: number;
}

interface SelectedItem {
  variant: ProductVariant;
  qty: number;
}

export const FieldNewSalePage: React.FC = () => {
  const { activeOrg } = useAuth();
  const queryClient = useQueryClient();

  const { data: products = [], isLoading: loadingProducts } = useQuery<ProductVariant[]>({
    queryKey: ['field-products'],
    queryFn: () => api.get<ProductVariant[]>('/field/products'),
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'ESEWA' | 'KHALTI' | 'OTHER'>('CASH');
  const [note, setNote] = useState('');

  const [showReviewModal, setShowReviewModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successSale, setSuccessSale] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Search filter
  const filteredProducts = useMemo(() => {
    if (!searchTerm.trim()) return products;
    const term = searchTerm.toLowerCase();
    return products.filter(
      (p) =>
        p.productName.toLowerCase().includes(term) ||
        p.sku.toLowerCase().includes(term),
    );
  }, [products, searchTerm]);

  // Compute total server-side style
  const totalPaisa = useMemo(() => {
    return selectedItems.reduce((acc, item) => {
      const linePaisa = BigInt(item.variant.pricePaisa) * BigInt(item.qty);
      return acc + linePaisa;
    }, 0n);
  }, [selectedItems]);

  const handleAddItem = (variant: ProductVariant) => {
    setSelectedItems((prev) => {
      const exists = prev.find((i) => i.variant.id === variant.id);
      if (exists) {
        return prev.map((i) =>
          i.variant.id === variant.id ? { ...i, qty: i.qty + 1 } : i,
        );
      }
      return [...prev, { variant, qty: 1 }];
    });
  };

  const handleUpdateQty = (variantId: string, delta: number) => {
    setSelectedItems((prev) => {
      return prev
        .map((i) => {
          if (i.variant.id === variantId) {
            const nextQty = i.qty + delta;
            return nextQty > 0 ? { ...i, qty: nextQty } : null;
          }
          return i;
        })
        .filter(Boolean) as SelectedItem[];
    });
  };

  const handleRemoveItem = (variantId: string) => {
    setSelectedItems((prev) => prev.filter((i) => i.variant.id !== variantId));
  };

  const handleResetSale = () => {
    setSelectedItems([]);
    setCustomerName('');
    setCustomerPhone('');
    setPaymentMethod('CASH');
    setNote('');
    setSuccessSale(null);
    setErrorMsg(null);
    setShowReviewModal(false);
  };

  const handleConfirmSale = async () => {
    setErrorMsg(null);
    setSubmitting(true);

    try {
      const payload = {
        items: selectedItems.map((item) => ({
          variantId: item.variant.id,
          qty: item.qty,
        })),
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        paymentMethod,
        note: note.trim() || undefined,
      };

      const res = await api.post('/field/sales', payload);
      queryClient.invalidateQueries({ queryKey: ['field-summary'] });
      queryClient.invalidateQueries({ queryKey: ['field-recent-sales'] });
      queryClient.invalidateQueries({ queryKey: ['field-sales'] });

      setShowReviewModal(false);
      setSuccessSale(res);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to record sale');
    } finally {
      setSubmitting(false);
    }
  };

  // Success State View
  if (successSale) {
    return (
      <div className="max-w-lg mx-auto bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-sm text-center space-y-6">
        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full mx-auto flex items-center justify-center">
          <CheckCircle2 className="w-10 h-10" />
        </div>

        <div>
          <h2 className="text-2xl font-bold text-gray-900">Sale Confirmed!</h2>
          <p className="text-sm text-gray-500 mt-1">Receipt ID #{successSale.id.slice(0, 8)}</p>
        </div>

        <div className="bg-gray-50 p-5 rounded-2xl border border-gray-200 text-left space-y-2.5 text-sm">
          <div className="flex justify-between items-center font-medium pb-2 border-b border-gray-200">
            <span className="text-gray-500">Amount Paid:</span>
            <span className="text-emerald-700 font-black text-lg">
              {formatMoney(successSale.totalPaisa)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Employer Company:</span>
            <span className="text-gray-900 font-semibold">{activeOrg?.orgName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Payment Method:</span>
            <span className="text-gray-900 font-medium">{successSale.paymentMethod}</span>
          </div>
          {successSale.customerName && (
            <div className="flex justify-between">
              <span className="text-gray-500">Customer:</span>
              <span className="text-gray-900 font-medium">{successSale.customerName}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-500">Items:</span>
            <span className="text-gray-900">{successSale.items?.length || selectedItems.length} items</span>
          </div>
        </div>

        <div className="space-y-3 pt-2">
          <button
            type="button"
            onClick={handleResetSale}
            className="w-full flex items-center justify-center space-x-2 px-6 py-3.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl shadow-xs font-bold text-base transition cursor-pointer"
          >
            <Plus className="w-5 h-5" />
            <span>Record another sale</span>
          </button>

          <Link
            to="/field/sales"
            className="w-full flex items-center justify-center space-x-2 py-3 text-sm font-semibold text-gray-700 hover:text-gray-900 rounded-xl hover:bg-gray-100 transition"
          >
            <Receipt className="w-4 h-4" />
            <span>View all sales</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-gray-200 gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight">
            Record a New Sale
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Products from <span className="font-semibold text-gray-800">{activeOrg?.orgName}</span>
          </p>
        </div>
        {selectedItems.length > 0 && (
          <button
            onClick={handleResetSale}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 px-3 py-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 transition cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear cart</span>
          </button>
        )}
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-sm flex items-start space-x-2">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Responsive Grid: 2 columns on lg/desktop (Catalog on left, Cart register on right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (Desktop: 7/12): Product Catalog Search & Selection */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-gray-600">
                  Select Products
                </h2>
                <p className="text-xs text-gray-400">Click any product to add to cart</p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 bg-gray-100 text-gray-600 rounded-lg">
                {filteredProducts.length} variants available
              </span>
            </div>

            {/* Search input */}
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search products by name or SKU..."
                className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition min-h-[48px]"
              />
            </div>

            {/* Products Grid */}
            {loadingProducts ? (
              <div className="py-16 text-center text-sm text-gray-400">Loading catalog items...</div>
            ) : filteredProducts.length === 0 ? (
              <div className="py-16 text-center text-sm text-gray-500 space-y-1">
                <p className="font-semibold text-gray-700">No matching products found</p>
                <p className="text-xs text-gray-400">Try adjusting your search query</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {filteredProducts.map((p) => {
                  const inCart = selectedItems.find((i) => i.variant.id === p.id);
                  return (
                    <div
                      key={p.id}
                      onClick={() => handleAddItem(p)}
                      className={`p-3.5 rounded-xl border transition cursor-pointer flex flex-col justify-between select-none active:scale-[0.99] ${
                        inCart
                          ? 'border-blue-500 bg-blue-50/50 shadow-2xs'
                          : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-xs'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2">
                            {p.productName}
                          </p>
                          {inCart && (
                            <span className="shrink-0 px-2 py-0.5 bg-blue-600 text-white rounded-md text-xs font-bold">
                              {inCart.qty}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 font-mono mt-1">
                          {p.sku} • {p.unit}
                        </p>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between">
                        <span className="text-sm font-bold text-gray-900">
                          {formatMoney(p.pricePaisa)}
                        </span>
                        <button
                          type="button"
                          className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-blue-600 hover:text-white text-gray-700 flex items-center justify-center transition"
                          title="Add item"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (Desktop: 5/12): Order Register & Checkout Details (Sticky on desktop) */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-4 lg:sticky lg:top-20">
          {/* Cart Items List */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-gray-500" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-gray-600">
                  Cart Items ({selectedItems.length})
                </h2>
              </div>
              <span className="text-sm font-extrabold text-blue-600">
                {formatMoney(totalPaisa.toString())}
              </span>
            </div>

            {selectedItems.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
                No items added yet. Click products to add.
              </div>
            ) : (
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1 divide-y divide-gray-100">
                {selectedItems.map((item) => {
                  const lineTotal = BigInt(item.variant.pricePaisa) * BigInt(item.qty);
                  return (
                    <div key={item.variant.id} className="pt-3 first:pt-0 flex items-center justify-between">
                      <div className="flex-1 pr-3 min-w-0">
                        <p className="font-semibold text-gray-900 text-xs sm:text-sm truncate">
                          {item.variant.productName}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {formatMoney(item.variant.pricePaisa)} × {item.qty} ={' '}
                          <span className="font-semibold text-gray-700">{formatMoney(lineTotal.toString())}</span>
                        </p>
                      </div>

                      <div className="flex items-center space-x-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(item.variant.id, -1)}
                          className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-700 rounded-lg transition"
                          title="Decrease quantity"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-6 text-center font-bold text-xs text-gray-900">
                          {item.qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(item.variant.id, 1)}
                          className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-700 rounded-lg transition"
                          title="Increase quantity"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.variant.id)}
                          className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-rose-600 transition"
                          title="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Customer & Payment Form */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-4 sm:p-5 space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-600 flex items-center gap-2">
              <User className="w-4 h-4 text-gray-500" />
              <span>Customer & Payment</span>
            </h2>

            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Customer Name (Optional)
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Ram Bahadur"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Customer Phone (Optional)
                </label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="e.g. 9841000000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Payment Method
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('CASH')}
                    className={`p-2.5 rounded-xl border flex items-center justify-center space-x-2 font-bold text-xs transition cursor-pointer ${
                      paymentMethod === 'CASH'
                        ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-2xs'
                        : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Banknote className="w-4 h-4 text-emerald-600" />
                    <span>Cash</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('ESEWA')}
                    className={`p-2.5 rounded-xl border flex items-center justify-center space-x-2 font-bold text-xs transition cursor-pointer ${
                      paymentMethod === 'ESEWA'
                        ? 'border-green-600 bg-green-50 text-green-700 shadow-2xs'
                        : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Smartphone className="w-4 h-4 text-green-600" />
                    <span>eSewa</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('KHALTI')}
                    className={`p-2.5 rounded-xl border flex items-center justify-center space-x-2 font-bold text-xs transition cursor-pointer ${
                      paymentMethod === 'KHALTI'
                        ? 'border-purple-600 bg-purple-50 text-purple-700 shadow-2xs'
                        : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Wallet className="w-4 h-4 text-purple-600" />
                    <span>Khalti</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('OTHER')}
                    className={`p-2.5 rounded-xl border flex items-center justify-center space-x-2 font-bold text-xs transition cursor-pointer ${
                      paymentMethod === 'OTHER'
                        ? 'border-gray-800 bg-gray-100 text-gray-900 shadow-2xs'
                        : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <CreditCard className="w-4 h-4 text-gray-600" />
                    <span>Other</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Sale Note (Optional)
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Optional delivery details or note..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Grand Total Summary & Review Button */}
              <div className="pt-3 border-t border-gray-100 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-700">Total Payable:</span>
                  <span className="text-xl font-black text-gray-900">
                    {formatMoney(totalPaisa.toString())}
                  </span>
                </div>

                <button
                  type="button"
                  disabled={selectedItems.length === 0}
                  onClick={() => setShowReviewModal(true)}
                  className="w-full flex items-center justify-center space-x-2 px-6 py-3.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl shadow-xs font-bold text-sm sm:text-base transition disabled:opacity-50 cursor-pointer"
                >
                  <span>Review and save ({formatMoney(totalPaisa.toString())})</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Summary Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-lg font-bold text-gray-900">Review sale summary</h3>
              <button
                type="button"
                onClick={() => setShowReviewModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="bg-blue-50 p-4 rounded-2xl border border-blue-200">
                <span className="text-xs text-blue-600 font-semibold uppercase block">
                  Total Amount Due
                </span>
                <span className="text-2xl font-black text-blue-900">
                  {formatMoney(totalPaisa.toString())}
                </span>
                <div className="mt-1 text-xs text-blue-700 font-medium">
                  Payment Method: <strong>{paymentMethod}</strong>
                </div>
              </div>

              {customerName && (
                <div className="flex justify-between py-1 border-b border-gray-100 text-xs">
                  <span className="text-gray-500">Customer:</span>
                  <span className="font-semibold text-gray-900">
                    {customerName} {customerPhone ? `(${customerPhone})` : ''}
                  </span>
                </div>
              )}

              {note && (
                <div className="py-1 border-b border-gray-100 text-xs">
                  <span className="text-gray-500 block">Note:</span>
                  <span className="text-gray-800 italic">{note}</span>
                </div>
              )}

              <div>
                <span className="text-xs font-semibold text-gray-500 block mb-2">
                  Items ({selectedItems.length}):
                </span>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 divide-y divide-gray-100">
                  {selectedItems.map((item) => (
                    <div key={item.variant.id} className="pt-1.5 first:pt-0 flex justify-between text-xs">
                      <div>
                        <span className="font-medium text-gray-800">{item.variant.productName}</span>
                        <span className="text-gray-400 block">{item.qty} × {formatMoney(item.variant.pricePaisa)}</span>
                      </div>
                      <span className="font-bold text-gray-900">
                        {formatMoney((BigInt(item.variant.pricePaisa) * BigInt(item.qty)).toString())}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                disabled={submitting}
                onClick={handleConfirmSale}
                className="w-full flex items-center justify-center space-x-2 px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl shadow-xs font-bold text-base transition disabled:opacity-50 cursor-pointer"
              >
                {submitting ? 'Confirming sale...' : 'Confirm and record sale'}
              </button>

              <button
                type="button"
                onClick={() => setShowReviewModal(false)}
                className="w-full py-2.5 text-center text-sm font-semibold text-gray-500 hover:text-gray-700"
              >
                Cancel & edit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
