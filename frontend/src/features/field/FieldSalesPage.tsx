import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { formatMoney } from '../../lib/money';
import { StatusBadge } from '../../components/StatusBadge';
import { Calendar, Filter, AlertTriangle } from 'lucide-react';

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
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'VOIDED'>('ALL');

  const { data: sales = [], isLoading } = useQuery<SaleRecord[]>({
    queryKey: ['field-my-sales', fromDate, toDate, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (fromDate) params.append('from', fromDate);
      if (toDate) params.append('to', toDate);
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      return api.get<SaleRecord[]>(`/field/sales?${params.toString()}`);
    },
  });

  // Group sales by day (formatted date string)
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
    <div className="space-y-5">
      <div className="pb-2 border-b border-gray-200">
        <h1 className="text-xl font-bold text-gray-900">My Sales History</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Review all sales recorded through your device
        </p>
      </div>

      {/* Date & Status Filters */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs space-y-3">
        <div className="flex items-center space-x-2 text-xs font-bold text-gray-700">
          <Filter className="w-4 h-4 text-gray-500" />
          <span>Filter sales</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">
              From Date
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full px-2.5 py-2 border border-gray-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">
              To Date
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full px-2.5 py-2 border border-gray-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
            />
          </div>
        </div>

        <div className="flex items-center space-x-2 pt-1">
          {(['ALL', 'ACTIVE', 'VOIDED'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold min-h-[36px] transition ${
                statusFilter === st
                  ? 'bg-blue-600 text-white'
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
              className="ml-auto text-xs font-semibold text-gray-400 hover:text-gray-700 min-h-[36px] px-2"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Sales List Grouped by Day */}
      {isLoading ? (
        <div className="p-12 text-center text-sm text-gray-400 bg-white rounded-2xl border border-gray-200">
          Loading sales history...
        </div>
      ) : groupedSales.length === 0 ? (
        <div className="p-12 text-center text-sm text-gray-500 bg-white rounded-2xl border border-gray-200">
          No sales found matching your filter criteria.
        </div>
      ) : (
        <div className="space-y-6">
          {groupedSales.map((group) => (
            <div key={group.date} className="space-y-2.5">
              {/* Day Header */}
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center space-x-1.5 text-xs font-bold text-gray-700">
                  <Calendar className="w-3.5 h-3.5 text-blue-600" />
                  <span>{group.date}</span>
                </div>
                <span className="text-xs font-extrabold text-gray-900">
                  Day Total: {formatMoney(group.totalDayPaisa.toString())}
                </span>
              </div>

              {/* Day Sales Cards */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-xs divide-y divide-gray-100 overflow-hidden">
                {group.items.map((sale) => (
                  <div key={sale.id} className="p-4 space-y-2 hover:bg-gray-50/60 transition">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-base font-bold text-gray-900">
                          {formatMoney(sale.totalPaisa)}
                        </div>
                        <div className="text-xs text-gray-500 flex items-center space-x-2 mt-0.5">
                          <span>{sale.items?.length || 0} items</span>
                          <span>•</span>
                          <span className="font-semibold text-gray-700">{sale.paymentMethod}</span>
                          <span>•</span>
                          <span>
                            {new Date(sale.soldAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>

                      <StatusBadge status={sale.status} />
                    </div>

                    {/* Customer info */}
                    {sale.customerName && (
                      <div className="text-xs text-gray-700">
                        Customer: <span className="font-medium">{sale.customerName}</span>
                        {sale.customerPhone && <span className="text-gray-400"> ({sale.customerPhone})</span>}
                      </div>
                    )}

                    {/* Items Snapshot pills */}
                    {sale.items && sale.items.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {sale.items.map((item, idx) => (
                          <span
                            key={idx}
                            className="inline-block px-2 py-0.5 bg-gray-100 text-gray-700 rounded-md text-[11px]"
                          >
                            {item.nameSnapshot} ×{item.qty}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Void reason banner if voided */}
                    {sale.status === 'VOIDED' && sale.voidReason && (
                      <div className="mt-2 p-2.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-2 text-rose-800 text-xs">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                        <div>
                          <span className="font-bold">Sale Voided: </span>
                          <span>{sale.voidReason}</span>
                        </div>
                      </div>
                    )}

                    {sale.note && (
                      <div className="text-[11px] text-gray-400 italic">
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
