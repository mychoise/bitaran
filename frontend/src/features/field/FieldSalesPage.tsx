import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { formatMoney } from '../../lib/money';
import { StatusBadge } from '../../components/StatusBadge';
import { Calendar, Filter, AlertTriangle, RotateCcw } from 'lucide-react';
import { useAuth } from '../../lib/auth';

interface SaleItem {
  id: string;
  nameSnapshot: string;
  skuSnapshot: string;
  unitPricePaisa: number;
  qty: number;
}

interface SaleRecord {
  id: string;
  customerName: string | null;
  customerPhone: string | null;
  paymentMethod: string;
  totalPaisa: string;
  status: 'ACTIVE' | 'VOIDED';
  voidReason: string | null;
  note: string | null;
  soldAt: string;
  items: SaleItem[];
}

export const FieldSalesPage: React.FC = () => {
  const { activeOrg } = useAuth();
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'VOIDED'>('ALL');

  const { data: sales = [], isLoading } = useQuery<SaleRecord[]>({
    queryKey: ['field-my-sales', fromDate, toDate, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (fromDate) params.set('from', fromDate);
      if (toDate) params.set('to', toDate);
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      return api.get<SaleRecord[]>(`/field/sales?${params.toString()}`);
    },
  });

  // Group sales by day (using Asia/Kathmandu format)
  const groupedSales = useMemo(() => {
    const groups: Record<string, SaleRecord[]> = {};

    for (const sale of sales) {
      const dateKey = new Date(sale.soldAt).toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });

      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(sale);
    }

    return Object.entries(groups).map(([date, items]) => ({
      date,
      items,
      totalDayPaisa: items.reduce((acc, s) => {
        return s.status === 'ACTIVE' ? acc + BigInt(s.totalPaisa) : acc;
      }, 0n),
    }));
  }, [sales]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-gray-200 gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight">My Sales History</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Sales recorded for <span className="font-semibold text-gray-800">{activeOrg?.orgName}</span>
          </p>
        </div>
        <div className="text-xs text-gray-400 font-medium">
          Total recorded sales: <span className="text-gray-900 font-bold">{sales.length}</span>
        </div>
      </div>

      {/* Date & Status Filters Toolbar (Responsive Desktop & Mobile) */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Date pickers */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2 text-xs font-bold text-gray-700">
            <Filter className="w-4 h-4 text-gray-400" />
            <span className="hidden sm:inline">Date:</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-xs text-gray-400">to</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Status Pills & Reset */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-700 hidden sm:inline">Status:</span>
          {(['ALL', 'ACTIVE', 'VOIDED'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                statusFilter === st
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {st === 'ALL' ? 'All' : st === 'ACTIVE' ? 'Active' : 'Voided'}
            </button>
          ))}

          {(fromDate || toDate || statusFilter !== 'ALL') && (
            <button
              type="button"
              onClick={() => {
                setFromDate('');
                setToDate('');
                setStatusFilter('ALL');
              }}
              className="ml-auto md:ml-2 inline-flex items-center gap-1 text-xs font-semibold text-gray-400 hover:text-gray-700 px-2 py-1 rounded-md transition cursor-pointer"
              title="Reset filters"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Sales List Grouped by Day */}
      {isLoading ? (
        <div className="p-16 text-center text-sm text-gray-400 bg-white rounded-2xl border border-gray-200">
          Loading sales history...
        </div>
      ) : groupedSales.length === 0 ? (
        <div className="p-16 text-center text-sm text-gray-500 bg-white rounded-2xl border border-gray-200 space-y-1">
          <p className="font-semibold text-gray-700">No sales found matching your filter criteria.</p>
          <p className="text-xs text-gray-400">Try adjusting your date range or status filter.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedSales.map((group) => (
            <div key={group.date} className="space-y-2.5">
              {/* Day Header */}
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center space-x-2 text-xs sm:text-sm font-bold text-gray-800">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <span>{group.date}</span>
                </div>
                <span className="text-xs sm:text-sm font-black text-gray-900 bg-gray-100 px-3 py-1 rounded-lg">
                  Day Total: {formatMoney(group.totalDayPaisa.toString())}
                </span>
              </div>

              {/* Day Sales Cards / Table */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-xs divide-y divide-gray-100 overflow-hidden">
                {group.items.map((sale) => (
                  <div key={sale.id} className="p-4 sm:p-5 space-y-2.5 hover:bg-gray-50/60 transition">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <span className={`text-base sm:text-lg font-bold ${
                            sale.status === 'VOIDED' ? 'line-through text-gray-400' : 'text-gray-900'
                          }`}>
                            {formatMoney(sale.totalPaisa)}
                          </span>
                          <StatusBadge status={sale.status} />
                        </div>

                        <div className="text-xs text-gray-500 flex flex-wrap items-center gap-2">
                          <span className="font-medium text-gray-700">
                            {sale.items?.length || 0} items
                          </span>
                          <span>•</span>
                          <span className="font-semibold text-emerald-700">{sale.paymentMethod}</span>
                          <span>•</span>
                          <span>
                            {new Date(sale.soldAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>

                      {/* Customer info */}
                      <div className="text-right text-xs text-gray-600">
                        <div className="font-semibold text-gray-900">
                          {sale.customerName || 'Walk-in Customer'}
                        </div>
                        {sale.customerPhone && (
                          <div className="text-gray-400 font-mono mt-0.5">
                            {sale.customerPhone}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Items Snapshot pills */}
                    {sale.items && sale.items.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {sale.items.map((item, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 text-gray-700 rounded-lg text-xs"
                          >
                            <span className="font-medium text-gray-900">{item.nameSnapshot}</span>
                            <span className="text-gray-400">×{item.qty}</span>
                            <span className="font-semibold text-gray-600">
                              ({formatMoney(BigInt(item.unitPricePaisa) * BigInt(item.qty))})
                            </span>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Void reason banner if voided */}
                    {sale.status === 'VOIDED' && sale.voidReason && (
                      <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-2 text-rose-800 text-xs">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                        <div>
                          <span className="font-bold">Sale Voided: </span>
                          <span>{sale.voidReason}</span>
                        </div>
                      </div>
                    )}

                    {sale.note && (
                      <div className="text-xs text-gray-400 italic">
                        Note: {sale.note}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
