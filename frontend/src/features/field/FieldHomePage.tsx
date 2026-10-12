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
    <div className="space-y-5">
      {/* Company Affiliation Banner */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex items-center justify-between">
        <div className="flex items-center space-x-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0 border border-blue-100">
            <Building2 className="w-5 h-5 text-blue-600" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">
              Selling for
            </span>
            <span className="text-sm font-bold text-gray-900 tracking-tight block truncate">
              {activeOrg?.orgName || 'Wholesale Business'}
            </span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Active Seller
          </span>
          <div className="text-2xs text-gray-400 font-mono mt-0.5">
            @{user?.username || 'seller'}
          </div>
        </div>
      </div>

      {/* Action Button: Large Record a Sale */}
      <div>
        <Link
          to="/field/sales/new"
          className="w-full flex items-center justify-center space-x-3 px-6 py-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-2xl shadow-md min-h-[56px] font-bold text-lg transition tracking-tight"
        >
          <PlusCircle className="w-6 h-6 shrink-0" />
          <span>Record a sale</span>
        </Link>
      </div>

      {/* Two Metric Tiles */}
      <div className="grid grid-cols-1 gap-4">
        {/* Tile 1: Sold Today */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Sold Today
            </span>
            <Calendar className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-gray-900 tracking-tight">
            {loadingSummary ? '...' : formatMoney(summary?.todayTotalPaisa || '0')}
          </div>
          <div className="mt-1 text-xs text-gray-500 font-medium">
            {loadingSummary ? '...' : `${summary?.todayCount || 0} sale${summary?.todayCount === 1 ? '' : 's'} recorded today`}
          </div>
        </div>

        {/* Tile 2: Sold To Date */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Sold To Date
            </span>
            <ShoppingBag className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-gray-900 tracking-tight">
            {loadingSummary ? '...' : formatMoney(summary?.allTimeTotalPaisa || '0')}
          </div>
          <div className="mt-1 text-xs text-gray-500 font-medium flex items-center space-x-2">
            <span>
              {loadingSummary ? '...' : `${summary?.allTimeCount || 0} sales`}
            </span>
            <span>•</span>
            <span>
              {loadingSummary ? '...' : `${summary?.allTimeUnits || 0} units`}
            </span>
          </div>
        </div>
      </div>

      {/* 5 Most Recent Sales */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">Recent sales</h2>
          <Link
            to="/field/sales"
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center space-x-1"
          >
            <span>View all</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="divide-y divide-gray-100">
          {loadingSales ? (
            <div className="p-6 text-center text-sm text-gray-400">Loading sales...</div>
          ) : top5Sales.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-500">
              No sales recorded yet. Tap "Record a sale" to start!
            </div>
          ) : (
            top5Sales.map((sale) => (
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
                    <span>{new Date(sale.soldAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
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
            ))
          )}
        </div>
      </div>
    </div>
  );
};
