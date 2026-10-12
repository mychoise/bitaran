import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { formatMoney } from '../../lib/money';
import { StatusBadge } from '../../components/StatusBadge';
import { PlusCircle, ShoppingBag, Calendar, ArrowRight, Building2 } from 'lucide-react';
import { useAuth } from '../../lib/auth';

interface SummaryData {
  todayTotalPaisa: string;
  todayCount: number;
  allTimeTotalPaisa: string;
  allTimeCount: number;
  allTimeUnits: number;
}

export const FieldHomePage: React.FC = () => {
  const { user, activeOrg } = useAuth();
  const { data: summary, isLoading: loadingSummary } = useQuery<SummaryData>({
    queryKey: ['field-summary'],
    queryFn: () => api.get<SummaryData>('/field/me/summary'),
  });

  const { data: recentSales = [], isLoading: loadingSales } = useQuery<any[]>({
    queryKey: ['field-recent-sales'],
    queryFn: () => api.get<any[]>('/field/sales?page=1'),
  });

  const top5Sales = recentSales.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Company Affiliation Banner */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-3.5 min-w-0">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0 border border-blue-100">
            <Building2 className="w-6 h-6 text-blue-600" />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">
              Selling on behalf of
            </span>
            <span className="text-lg font-bold text-gray-900 tracking-tight block truncate">
              {activeOrg?.orgName || 'Wholesale Business'}
            </span>
          </div>
        </div>
        <div className="flex items-center sm:flex-col sm:items-end justify-between gap-1 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Active Field Representative
          </span>
          <div className="text-xs text-gray-400 font-mono mt-0.5">
            Logged in as @{user?.username || 'seller'}
          </div>
        </div>
      </div>

      {/* Metric Cards (1 col mobile, 2 col sm, 3 col lg) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Tile 1: Sold Today */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-gray-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Sold Today
              </span>
              <Calendar className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-2xl lg:text-3xl font-black text-gray-900 tracking-tight">
              {loadingSummary ? '...' : formatMoney(summary?.todayTotalPaisa || '0')}
            </div>
          </div>
          <div className="mt-3 text-xs text-gray-500 font-medium pt-2 border-t border-gray-100">
            {loadingSummary
              ? '...'
              : `${summary?.todayCount || 0} transaction${summary?.todayCount === 1 ? '' : 's'} today (Kathmandu)`}
          </div>
        </div>

        {/* Tile 2: Sold To Date */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-gray-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Sold To Date
              </span>
              <ShoppingBag className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl lg:text-3xl font-black text-gray-900 tracking-tight">
              {loadingSummary ? '...' : formatMoney(summary?.allTimeTotalPaisa || '0')}
            </div>
          </div>
          <div className="mt-3 text-xs text-gray-500 font-medium flex items-center space-x-2 pt-2 border-t border-gray-100">
            <span>{loadingSummary ? '...' : `${summary?.allTimeCount || 0} sales`}</span>
            <span>•</span>
            <span>{loadingSummary ? '...' : `${summary?.allTimeUnits || 0} physical units`}</span>
          </div>
        </div>

        {/* Tile 3: Quick Action / POS Record Sale Button */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white p-5 rounded-2xl shadow-sm flex flex-col justify-between sm:col-span-2 lg:col-span-1">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-100 block mb-1">
              Point of Sale
            </span>
            <div className="text-lg font-bold text-white">Record Customer Sale</div>
            <p className="text-xs text-blue-100 mt-1">
              Quickly create receipts with server-snapshotted pricing and instant confirmation.
            </p>
          </div>
          <div className="mt-4">
            <Link
              to="/field/sales/new"
              className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-white hover:bg-blue-50 text-blue-700 rounded-xl font-bold text-sm shadow-sm transition tracking-tight"
            >
              <PlusCircle className="w-5 h-5 shrink-0" />
              <span>Open Sales Register</span>
            </Link>
          </div>
        </div>
      </div>

      {/* 5 Most Recent Sales */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900">Recent Transactions</h2>
            <p className="text-xs text-gray-500">Latest sales recorded under your account</p>
          </div>
          <Link
            to="/field/sales"
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center space-x-1"
          >
            <span>View all transactions</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loadingSales ? (
          <div className="p-8 text-center text-sm text-gray-400">Loading recent transactions...</div>
        ) : top5Sales.length === 0 ? (
          <div className="p-12 text-center text-sm text-gray-500 space-y-2">
            <p>No sales recorded yet.</p>
            <Link
              to="/field/sales/new"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:underline"
            >
              <PlusCircle className="w-4 h-4" />
              Record your first sale now
            </Link>
          </div>
        ) : (
          <>
            {/* Desktop Table View (hidden on mobile) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600">
                <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500 border-b border-gray-100">
                  <tr>
                    <th className="px-5 py-3.5">Time</th>
                    <th className="px-5 py-3.5">Customer</th>
                    <th className="px-5 py-3.5 text-center">Items</th>
                    <th className="px-5 py-3.5">Payment</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {top5Sales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-gray-50/75 transition-colors">
                      <td className="px-5 py-4 whitespace-nowrap text-xs">
                        <div className="font-semibold text-gray-900">
                          {new Date(sale.soldAt).toLocaleDateString()}
                        </div>
                        <div className="text-gray-400">
                          {new Date(sale.soldAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-semibold text-gray-900">
                          {sale.customerName || 'Walk-in Customer'}
                        </div>
                        {sale.customerPhone && (
                          <div className="text-xs text-gray-400 font-mono">
                            {sale.customerPhone}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                          {sale.items?.length || 0} item{(sale.items?.length || 0) === 1 ? '' : 's'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-xs font-semibold text-gray-700">
                        {sale.paymentMethod}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <StatusBadge status={sale.status} />
                      </td>
                      <td className="px-5 py-4 text-right font-bold text-gray-900 text-base">
                        {formatMoney(sale.totalPaisa)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List View (hidden on md and larger) */}
            <div className="md:hidden divide-y divide-gray-100">
              {top5Sales.map((sale) => (
                <div key={sale.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition">
                  <div>
                    <div className="font-bold text-gray-900 text-base">
                      {formatMoney(sale.totalPaisa)}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5 flex items-center space-x-2">
                      <span>{sale.items?.length || 0} item{(sale.items?.length || 0) === 1 ? '' : 's'}</span>
                      <span>•</span>
                      <span className="font-medium text-gray-700">{sale.paymentMethod}</span>
                      <span>•</span>
                      <span>
                        {new Date(sale.soldAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    {sale.customerName && (
                      <div className="text-xs text-gray-600 mt-1">
                        Customer: {sale.customerName}
                      </div>
                    )}
                  </div>
                  <div>
                    <StatusBadge status={sale.status} />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
