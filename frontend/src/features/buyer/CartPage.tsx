import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { formatMoney } from '../../lib/money';
import { Trash2, Plus, Minus, ArrowRight, Store, ShieldAlert, ImageOff } from 'lucide-react';
import { useAuth } from '../../lib/auth';

interface CartGroup {
  sellerOrgId: string;
  sellerName: string;
  items: Array<{
    id: string;
    variantId: string;
    productId: string;
    productName: string;
    sku: string;
    unit: string;
    pricePaisa: number;
    qty: number;
    minOrderQty: number;
    lineTotalPaisa: number;
    imageUrl?: string;
  }>;
}

export const CartPage: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { activeOrg } = useAuth();
  const isApproved = activeOrg?.orgStatus === 'APPROVED';
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [paymentProvider, setPaymentProvider] = useState<'ESEWA' | 'KHALTI'>('ESEWA');
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);

  // Fetch cart
  const { data: cartData, isLoading: cartLoading } = useQuery({
    queryKey: ['cart'],
    queryFn: () => api.get<{ groups: CartGroup[] }>('/cart'),
  });

  // Fetch addresses
  const { data: addresses = [] } = useQuery({
    queryKey: ['addresses'],
    queryFn: () => api.get<any[]>('/orgs/addresses'),
  });

  // Set default address when loaded
  React.useEffect(() => {
    if (addresses.length > 0 && !selectedAddressId) {
      const def = addresses.find((a) => a.isDefault) || addresses[0];
      setSelectedAddressId(def.id);
    }
  }, [addresses, selectedAddressId]);

  const groups = cartData?.groups ?? [];

  const grandTotalPaisa = groups.reduce((total, group) => {
    const groupSubtotal = group.items.reduce((s, i) => s + i.pricePaisa * i.qty, 0);
    return total + groupSubtotal;
  }, 0);

  // Update item quantity
  const updateQty = async (variantId: string, newQty: number, moq: number) => {
    if (newQty < moq) return;
    try {
      await api.post('/cart/items', { variantId, qty: newQty });
      queryClient.invalidateQueries({ queryKey: ['cart'] });
    } catch (err: any) {
      setCheckoutError(err.message || 'Failed to update quantity');
    }
  };

  // Remove item
  const removeItem = async (variantId: string) => {
    try {
      await api.delete(`/cart/items/${variantId}`);
      queryClient.invalidateQueries({ queryKey: ['cart'] });
    } catch (err: any) {
      setCheckoutError(err.message || 'Failed to remove item');
    }
  };

  // Checkout action
  const handleCheckout = async () => {
    if (!isApproved) {
      setCheckoutError('Your business account is pending approval. You cannot place orders until verified by an administrator.');
      return;
    }

    if (!selectedAddressId) {
      setCheckoutError('Please select or add a delivery address.');
      return;
    }

    try {
      setCheckingOut(true);
      setCheckoutError(null);

      const res = await api.post<any>('/checkout', {
        addressId: selectedAddressId,
        paymentProvider,
      });

      queryClient.invalidateQueries({ queryKey: ['cart'] });

      // Redirect to mock payment page
      if (res.paymentId) {
        navigate(`/payment/mock/${res.paymentId}`);
      } else if (res.orders?.[0]?.orderId) {
        navigate(`/orders/${res.orders[0].orderId}`);
      } else {
        navigate('/orders');
      }
    } catch (err: any) {
      setCheckoutError(err.message || 'Checkout failed. Please check stock availability.');
    } finally {
      setCheckingOut(false);
    }
  };

  if (cartLoading) {
    return (
      <div className="bg-white p-8 rounded-xl border border-gray-200 animate-pulse space-y-4">
        <div className="h-6 bg-gray-200 w-1/4 rounded" />
        <div className="h-24 bg-gray-200 rounded" />
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="bg-white p-12 text-center rounded-xl border border-gray-200 shadow-sm max-w-xl mx-auto">
        <h2 className="text-xl font-bold text-gray-900">Your cart is empty</h2>
        <p className="mt-2 text-sm text-gray-500">
          Explore products from verified sellers and place wholesale orders.
        </p>
        <Link
          to="/browse"
          className="mt-6 inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700"
        >
          Browse catalog &rarr;
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Cart and checkout</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Review items grouped per seller. One order will be created per seller upon checkout.
        </p>
      </div>

      {checkoutError && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl flex items-start space-x-2">
          <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{checkoutError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Grouped Cart Items */}
        <div className="lg:col-span-2 space-y-6">
          {groups.map((group) => {
            const groupSubtotal = group.items.reduce(
              (sum, item) => sum + item.pricePaisa * item.qty,
              0,
            );

            return (
              <div
                key={group.sellerOrgId}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm"
              >
                {/* Group Header */}
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Store className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-bold text-gray-900">{group.sellerName}</span>
                  </div>
                  <div className="text-xs text-gray-500">
                    Subtotal: <span className="font-bold text-gray-900">{formatMoney(groupSubtotal)}</span>
                  </div>
                </div>

                {/* Items */}
                <div className="divide-y divide-gray-100">
                  {group.items.map((item) => (
                    <div key={item.id} className="p-6 flex items-center justify-between gap-4">
                      {/* Left: Thumbnail & Info */}
                      <div className="flex items-center space-x-4">
                        <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden border border-gray-200 flex-shrink-0">
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.productName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-300">
                              <ImageOff className="w-5 h-5" aria-hidden="true" />
                            </div>
                          )}
                        </div>

                        <div>
                          <Link
                            to={`/products/${item.productId}`}
                            className="text-sm font-semibold text-gray-900 hover:text-indigo-600 line-clamp-1"
                          >
                            {item.productName}
                          </Link>
                          <p className="text-xs text-gray-500 font-mono mt-0.5">SKU: {item.sku}</p>
                          <p className="text-xs font-semibold text-gray-900 mt-1">
                            {formatMoney(item.pricePaisa)} / {item.unit}
                          </p>
                        </div>
                      </div>

                      {/* Right: Quantity Stepper & Total */}
                      <div className="flex items-center space-x-6">
                        <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
                          <button
                            onClick={() => updateQty(item.variantId, item.qty - 1, item.minOrderQty)}
                            disabled={item.qty <= item.minOrderQty}
                            className="p-2 bg-gray-50 hover:bg-gray-100 text-gray-600 disabled:opacity-30 disabled:hover:bg-gray-50"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-12 text-center text-sm font-semibold text-gray-900">
                            {item.qty}
                          </span>
                          <button
                            onClick={() => updateQty(item.variantId, item.qty + 1, item.minOrderQty)}
                            className="p-2 bg-gray-50 hover:bg-gray-100 text-gray-600"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="text-right w-24">
                          <div className="text-sm font-bold text-gray-900">
                            {formatMoney(item.pricePaisa * item.qty)}
                          </div>
                        </div>

                        <button
                          onClick={() => removeItem(item.variantId)}
                          className="text-gray-400 hover:text-rose-600 transition"
                          title="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Right 1 Col: Checkout Panel */}
        <div className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6">
            <h2 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-3">
              Order Summary
            </h2>

            {/* Delivery Address Select */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="address-select" className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                  Delivery Address
                </label>
                <Link to="/addresses" className="text-xs text-indigo-600 hover:underline">
                  + Add address
                </Link>
              </div>

              {addresses.length === 0 ? (
                <div className="p-3 bg-amber-50 text-amber-800 text-xs rounded-lg">
                  No address found.{' '}
                  <Link to="/addresses" className="font-semibold underline">
                    Add one here
                  </Link>
                </div>
              ) : (
                <select
                  id="address-select"
                  value={selectedAddressId}
                  onChange={(e) => setSelectedAddressId(e.target.value)}
                  className="w-full text-sm bg-gray-50 border border-gray-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {addresses.map((a: any) => (
                    <option key={a.id} value={a.id}>
                      {a.label ? `${a.label}: ` : ''}{a.line1}, {a.city} {a.isDefault ? '(Default)' : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Payment Method Radio */}
            <div>
              <span className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">
                Pay with
              </span>
              <div className="grid grid-cols-2 gap-3">
                <label
                  className={`p-3 border rounded-xl flex items-center space-x-3 cursor-pointer transition ${
                    paymentProvider === 'ESEWA'
                      ? 'border-emerald-600 bg-emerald-50/50 ring-1 ring-emerald-600'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="payment"
                    value="ESEWA"
                    checked={paymentProvider === 'ESEWA'}
                    onChange={() => setPaymentProvider('ESEWA')}
                    className="text-emerald-600 focus:ring-emerald-600"
                  />
                  <div>
                    <span className="block text-sm font-bold text-gray-900">eSewa</span>
                    <span className="block text-xs text-gray-500">Digital Wallet</span>
                  </div>
                </label>

                <label
                  className={`p-3 border rounded-xl flex items-center space-x-3 cursor-pointer transition ${
                    paymentProvider === 'KHALTI'
                      ? 'border-purple-600 bg-purple-50/50 ring-1 ring-purple-600'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="payment"
                    value="KHALTI"
                    checked={paymentProvider === 'KHALTI'}
                    onChange={() => setPaymentProvider('KHALTI')}
                    className="text-purple-600 focus:ring-purple-600"
                  />
                  <div>
                    <span className="block text-sm font-bold text-gray-900">Khalti</span>
                    <span className="block text-xs text-gray-500">Digital Wallet</span>
                  </div>
                </label>
              </div>
            </div>

            {/* Breakdown */}
            <div className="space-y-2.5 pt-4 border-t border-gray-100 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal ({groups.length} {groups.length === 1 ? 'seller' : 'sellers'})</span>
                <span className="font-semibold text-gray-900">{formatMoney(grandTotalPaisa)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Platform delivery fee</span>
                <span className="font-semibold text-emerald-600">Rs 0.00 (Flat)</span>
              </div>
              <div className="flex justify-between text-base font-bold text-gray-900 pt-3 border-t border-gray-100">
                <span>Total amount</span>
                <span>{formatMoney(grandTotalPaisa)}</span>
              </div>
            </div>

            {!isApproved && (
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl flex items-start space-x-2">
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Account Approval Required</p>
                  <p className="mt-0.5">
                    Your business is in {activeOrg?.orgStatus || 'PENDING'} review. An administrator must approve your business documents before you can place orders.
                  </p>
                </div>
              </div>
            )}

            <button
              onClick={handleCheckout}
              disabled={checkingOut || addresses.length === 0 || !isApproved}
              className="w-full py-3 px-4 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition flex items-center justify-center space-x-2"
            >
              <span>
                {checkingOut
                  ? 'Creating orders...'
                  : !isApproved
                  ? 'Pending Platform Approval'
                  : 'Pay and place orders'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <p className="text-xs text-gray-500 text-center leading-normal">
              Note: This single checkout will automatically generate one independent order per seller. Payments are routed direct to seller accounts.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
