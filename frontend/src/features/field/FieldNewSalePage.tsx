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

  // Total paisa calculation
  const totalPaisa = useMemo(() => {
    return selectedItems.reduce((acc, item) => {
      return acc + BigInt(item.variant.pricePaisa) * BigInt(item.qty);
    }, 0n);
  }, [selectedItems]);

  const handleAddItem = (variant: ProductVariant) => {
    setSelectedItems((prev) => {
      const existing = prev.find((i) => i.variant.id === variant.id);
      if (existing) {
        return prev.map((i) =>
          i.variant.id === variant.id ? { ...i, qty: i.qty + 1 } : i,
        );
      }
      return [...prev, { variant, qty: 1 }];
    });
  };

  const handleUpdateQty = (variantId: string, delta: number) => {
    setSelectedItems((prev) =>
      prev
        .map((i) => {
          if (i.variant.id === variantId) {
            const newQty = i.qty + delta;
            return newQty > 0 ? { ...i, qty: newQty } : null;
          }
          return i;
        })
        .filter(Boolean) as SelectedItem[],
    );
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
      <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm text-center space-y-6">
        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full mx-auto flex items-center justify-center">
          <CheckCircle2 className="w-10 h-10" />
        </div>

        <div>
          <h2 className="text-2xl font-bold text-gray-900">Sale Confirmed!</h2>
          <p className="text-sm text-gray-500 mt-1">Sale record #{successSale.id.slice(0, 8)}</p>
        </div>

        <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 text-left space-y-2 text-sm">
          <div className="flex justify-between font-medium">
            <span className="text-gray-500">Amount Paid:</span>
            <span className="text-gray-900 font-bold text-base">
              {formatMoney(successSale.totalPaisa)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Payment:</span>
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
            onClick={handleResetSale}
            className="w-full flex items-center justify-center space-x-2 px-6 py-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl shadow-md min-h-[52px] font-bold text-base transition"
          >
            <Plus className="w-5 h-5" />
            <span>Record another</span>
          </button>

          <Link
            to="/field/sales"
            className="w-full block py-3.5 text-center text-sm font-semibold text-gray-600 hover:text-gray-900 min-h-[48px]"
          >
            View sales history
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-2 border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-gray-900 leading-tight">Record a new sale</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Products from <span className="font-semibold text-gray-800">{activeOrg?.orgName}</span>
          </p>
        </div>
        {selectedItems.length > 0 && (
          <button
            onClick={handleResetSale}
            className="text-xs font-semibold text-rose-600 hover:text-rose-700 min-h-[48px] px-2 flex items-center"
          >
            Clear all
          </button>
        )}
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-sm flex items-start space-x-2">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Selected Items Card (Running List) */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500">
            Cart ({selectedItems.length})
          </h2>
          <div className="text-right">
            <span className="text-xs text-gray-400 block">Total amount</span>
            <span className="text-xl font-extrabold text-gray-900">
              {formatMoney(totalPaisa.toString())}
            </span>
          </div>
        </div>

        {selectedItems.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
            No items selected yet. Tap products below to add.
          </div>
        ) : (
          <div className="space-y-3 divide-y divide-gray-100">
            {selectedItems.map((item) => {
              const lineTotal = BigInt(item.variant.pricePaisa) * BigInt(item.qty);
              return (
                <div key={item.variant.id} className="pt-3 first:pt-0 flex items-center justify-between">
                  <div className="flex-1 pr-3">
                    <p className="font-semibold text-gray-900 text-sm leading-tight">
                      {item.variant.productName}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formatMoney(item.variant.pricePaisa)} / {item.variant.unit}
                    </p>
                    <p className="text-xs font-bold text-blue-600 mt-1">
                      Line: {formatMoney(lineTotal.toString())}
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => handleUpdateQty(item.variant.id, -1)}
                      className="w-10 h-10 min-h-[44px] min-w-[44px] flex items-center justify-center bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-700 rounded-xl transition"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-8 text-center font-bold text-sm text-gray-900">
                      {item.qty}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleUpdateQty(item.variant.id, 1)}
                      className="w-10 h-10 min-h-[44px] min-w-[44px] flex items-center justify-center bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-700 rounded-xl transition"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.variant.id)}
                      className="w-10 h-10 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-400 hover:text-rose-600 transition ml-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Customer & Payment Form */}
      {selectedItems.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-4 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500">
            Customer & Payment
          </h2>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Customer Name (Optional)
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g. Ram Bahadur"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[48px]"
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
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[48px]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Payment Method
              </label>
              {/* Four Large Buttons with 48px Touch Targets */}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('CASH')}
                  className={`min-h-[52px] p-3 rounded-xl border flex items-center justify-center space-x-2 font-bold text-sm transition ${
                    paymentMethod === 'CASH'
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Banknote className="w-5 h-5 text-emerald-600" />
                  <span>Cash</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('ESEWA')}
                  className={`min-h-[52px] p-3 rounded-xl border flex items-center justify-center space-x-2 font-bold text-sm transition ${
                    paymentMethod === 'ESEWA'
                      ? 'border-green-600 bg-green-50 text-green-700'
                      : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Smartphone className="w-5 h-5 text-green-600" />
                  <span>eSewa</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('KHALTI')}
                  className={`min-h-[52px] p-3 rounded-xl border flex items-center justify-center space-x-2 font-bold text-sm transition ${
                    paymentMethod === 'KHALTI'
                      ? 'border-purple-600 bg-purple-50 text-purple-700'
                      : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Wallet className="w-5 h-5 text-purple-600" />
                  <span>Khalti</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('OTHER')}
                  className={`min-h-[52px] p-3 rounded-xl border flex items-center justify-center space-x-2 font-bold text-sm transition ${
                    paymentMethod === 'OTHER'
                      ? 'border-gray-800 bg-gray-100 text-gray-900'
                      : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <CreditCard className="w-5 h-5 text-gray-600" />
                  <span>Other</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Note (Optional)
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional delivery details or note..."
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowReviewModal(true)}
              className="w-full flex items-center justify-center space-x-2 px-6 py-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl shadow-md min-h-[52px] font-bold text-base transition"
            >
              <span>Review and save ({formatMoney(totalPaisa.toString())})</span>
            </button>
          </div>
        </div>
      )}

      {/* Search & Product Selection List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500">
            Catalog Products
          </h2>
          <span className="text-xs text-gray-400">{filteredProducts.length} variants</span>
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by product name or SKU..."
            className="w-full pl-11 pr-4 py-3 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[48px]"
          />
        </div>

        {/* Product Cards */}
        {loadingProducts ? (
          <div className="p-8 text-center text-sm text-gray-400 bg-white rounded-2xl border border-gray-200">
            Loading catalog...
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500 bg-white rounded-2xl border border-gray-200">
            No products match your search.
          </div>
        ) : (
          <div className="space-y-2">
            {filteredProducts.map((p) => {
              const inCart = selectedItems.find((i) => i.variant.id === p.id);
              return (
                <div
                  key={p.id}
                  onClick={() => handleAddItem(p)}
                  className={`p-4 bg-white rounded-xl border transition cursor-pointer flex items-center justify-between min-h-[64px] active:scale-[0.99] ${
                    inCart
                      ? 'border-blue-400 bg-blue-50/40 ring-1 ring-blue-300'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex-1 pr-3">
                    <p className="font-semibold text-gray-900 text-sm">{p.productName}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      SKU: {p.sku} • {p.unit}
                    </p>
                    <p className="text-sm font-bold text-gray-900 mt-1">
                      {formatMoney(p.pricePaisa)}
                    </p>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    {inCart ? (
                      <span className="px-2.5 py-1 bg-blue-600 text-white rounded-lg text-xs font-bold">
                        {inCart.qty} in cart
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="w-10 h-10 min-h-[44px] min-w-[44px] bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl flex items-center justify-center transition"
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirmation Summary Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-md w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-lg font-bold text-gray-900">Review sale summary</h3>
              <button
                type="button"
                onClick={() => setShowReviewModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
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
                  Items Snapshot ({selectedItems.length}):
                </span>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 divide-y divide-gray-100">
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
                className="w-full flex items-center justify-center space-x-2 px-6 py-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl shadow-md min-h-[52px] font-bold text-base transition disabled:opacity-50"
              >
                {submitting ? 'Confirming sale...' : 'Confirm sale'}
              </button>

              <button
                type="button"
                onClick={() => setShowReviewModal(false)}
                className="w-full py-3 text-center text-sm font-semibold text-gray-500 hover:text-gray-700 min-h-[48px]"
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
