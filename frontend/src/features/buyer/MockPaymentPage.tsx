import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { formatMoney } from '../../lib/money';
import { APP_NAME } from '../../config/app.config';
import { ShieldCheck, CheckCircle2, XCircle, ArrowRight } from 'lucide-react';

export const MockPaymentPage: React.FC = () => {
  const { paymentId } = useParams<{ paymentId: string }>();
  const navigate = useNavigate();
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<'success' | 'failed' | null>(null);

  const { data: payment, isLoading, error } = useQuery({
    queryKey: ['mock-payment', paymentId],
    queryFn: () => api.get<any>(`/payments/${paymentId}`),
    enabled: !!paymentId,
  });

  const handleAction = async (action: 'pay' | 'fail') => {
    try {
      setProcessing(true);
      await api.post(`/payments/${paymentId}/mock-callback`, { action });

      setResult(action === 'pay' ? 'success' : 'failed');

      setTimeout(() => {
        if (action === 'pay') {
          navigate(payment?.orderId ? `/orders/${payment.orderId}` : '/orders');
        } else {
          navigate('/cart');
        }
      }, 1800);
    } catch (err: any) {
      alert(err.message || 'Payment processing error');
      setProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm text-center">Loading gateway...</div>
      </div>
    );
  }

  if (error || !payment) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm text-center">
          <p className="text-rose-600 font-bold">Payment session not found or expired.</p>
        </div>
      </div>
    );
  }

  const providerName = payment.provider === 'KHALTI' ? 'Khalti' : 'eSewa';

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden">
        {/* Gateway Mock Header */}
        <div className="p-6 bg-gradient-to-r from-gray-900 to-gray-800 text-white text-center">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-white/10 rounded-full text-xs font-semibold uppercase tracking-wider mb-2">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Mock Gateway Sandbox</span>
          </div>
          <h1 className="text-xl font-bold">{providerName} Payment Gateway</h1>
          <p className="text-xs text-gray-300 mt-1">Merchant Checkout for {APP_NAME}</p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {result ? (
            <div className="py-8 text-center space-y-3">
              {result === 'success' ? (
                <>
                  <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto animate-bounce" />
                  <h2 className="text-lg font-bold text-gray-900">Payment Successful!</h2>
                  <p className="text-xs text-gray-500">
                    Payment verified. Redirecting to your order confirmation...
                  </p>
                </>
              ) : (
                <>
                  <XCircle className="w-16 h-16 text-rose-500 mx-auto" />
                  <h2 className="text-lg font-bold text-gray-900">Payment Failed</h2>
                  <p className="text-xs text-gray-500">
                    Order cancelled and reserved stock released. Returning to cart...
                  </p>
                </>
              )}
            </div>
          ) : (
            <>
              {/* Transaction details card */}
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-2.5 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Payment reference</span>
                  <span className="font-mono text-xs font-semibold text-gray-900">
                    #{payment.id.slice(0, 10).toUpperCase()}
                  </span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Platform merchant</span>
                  <span className="font-semibold text-gray-900">{APP_NAME} Marketplace</span>
                </div>
                <div className="flex justify-between text-base font-bold text-gray-900 pt-2 border-t border-gray-200">
                  <span>Payable amount</span>
                  <span className="text-emerald-700">{formatMoney(payment.amountPaisa)}</span>
                </div>
              </div>

              <div className="text-xs text-gray-500 bg-amber-50 p-3 rounded-lg border border-amber-200 text-center">
                This simulates the external gateway postback callback. In production, payments route directly to the seller merchant account.
              </div>

              {/* Action Buttons: Pay and Fail */}
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => handleAction('pay')}
                  disabled={processing}
                  className="py-3 px-4 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition flex items-center justify-center space-x-1 disabled:opacity-50"
                >
                  <span>Pay</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  onClick={() => handleAction('fail')}
                  disabled={processing}
                  className="py-3 px-4 rounded-xl text-sm font-bold text-gray-700 bg-gray-100 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 border border-gray-200 transition disabled:opacity-50"
                >
                  Fail
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
