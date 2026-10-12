import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { formatMoney } from '../../lib/money';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import {
  TrendingUp,
  DollarSign,
  ShoppingBag,
  Package,
  CreditCard,
  Award,
} from 'lucide-react';

interface AnalyticsTotals {
  revenue: string;
  salesCount: number;
  units: number;
  avgSaleValue: string;
}

interface SellerLeaderboardItem {
  seller: {
    id: string;
    displayName: string;
    username: string;
  };
  revenue: string;
  salesCount: number;
  units: number;
  avgSaleValue: string;
}

interface DayRevenueItem {
  date: string;
  revenue: string;
  salesCount: number;
}

interface TopProductItem {
  productName: string;
  units: number;
  revenue: string;
}

interface PaymentMethodItem {
  method: string;
  revenue: string;
  count: number;
}

interface FieldAnalyticsResponse {
  totals: AnalyticsTotals;
  bySeller: SellerLeaderboardItem[];
  byDay: DayRevenueItem[];
  topProducts: TopProductItem[];
  byPaymentMethod: PaymentMethodItem[];
}

interface FieldSellerSummary {
  id: string;
  displayName: string;
  username: string;
}

export const FieldAnalyticsPage: React.FC = () => {
  // Preset: '7d' | '30d' | 'month' | 'custom'
  const [rangePreset, setRangePreset] = useState<'7d' | '30d' | 'month' | 'custom'>('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [selectedSellerId, setSelectedSellerId] = useState<string>('ALL');

  // Compute date range
  const getDateRange = () => {
    const now = new Date();
    if (rangePreset === '7d') {
      const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { from: from.toISOString(), to: now.toISOString() };
    }
    if (rangePreset === '30d') {
      const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return { from: from.toISOString(), to: now.toISOString() };
    }
    if (rangePreset === 'month') {
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: from.toISOString(), to: now.toISOString() };
    }
    // custom
    return {
      from: customFrom ? new Date(customFrom).toISOString() : undefined,
      to: customTo ? new Date(customTo + 'T23:59:59.999Z').toISOString() : undefined,
    };
  };

  const { from, to } = getDateRange();

  // 1. Fetch Sellers for Filter
  const { data: sellers = [] } = useQuery<FieldSellerSummary[]>({
    queryKey: ['seller-field-sellers-select'],
    queryFn: () => api.get<FieldSellerSummary[]>('/seller/field-sellers'),
  });

  // 2. Fetch Analytics
  const { data: analytics, isLoading, error } = useQuery<FieldAnalyticsResponse>({
    queryKey: ['seller-field-analytics', from, to, selectedSellerId],
    queryFn: () => {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      if (selectedSellerId !== 'ALL') params.set('fieldSellerId', selectedSellerId);
      return api.get<FieldAnalyticsResponse>(`/seller/field-analytics?${params.toString()}`);
    },
  });

  // Prepare chart data
  const chartData = (analytics?.byDay || []).map((d) => ({
    date: d.date.slice(5),
    fullDate: d.date,
    rupees: Number(BigInt(d.revenue) / 100n),
    revenue: d.revenue,
    salesCount: d.salesCount,
  }));

  // Payment method totals for percentage calculation
  const totalPaymentPaisa = (analytics?.byPaymentMethod || []).reduce(
    (sum, pm) => sum + BigInt(pm.revenue),
    0n,
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Field Sales Analytics</h1>
          <p className="text-sm text-gray-500 mt-1">
            Performance metrics, sales leaderboards, and payment distribution across your mobile team
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        {/* Date presets */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide mr-1">
            Range:
          </span>
          <button
            type="button"
            onClick={() => setRangePreset('7d')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
              rangePreset === '7d'
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Last 7 days
          </button>
          <button
            type="button"
            onClick={() => setRangePreset('30d')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
              rangePreset === '30d'
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Last 30 days
          </button>
          <button
            type="button"
            onClick={() => setRangePreset('month')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
              rangePreset === 'month'
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            This month
          </button>
          <button
            type="button"
            onClick={() => setRangePreset('custom')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
              rangePreset === 'custom'
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Custom
          </button>

          {/* Custom Date Inputs */}
          {rangePreset === 'custom' && (
            <div className="flex items-center gap-2 ml-2">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="text-xs border border-gray-300 rounded-lg px-2 py-1 focus:ring-1 focus:ring-emerald-500"
              />
              <span className="text-xs text-gray-400">to</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="text-xs border border-gray-300 rounded-lg px-2 py-1 focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          )}
        </div>

        {/* Seller Filter */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Seller:
          </label>
          <select
            value={selectedSellerId}
            onChange={(e) => setSelectedSellerId(e.target.value)}
            className="text-xs border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
          >
            <option value="ALL">All Field Sellers</option>
            {sellers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.displayName} (@{s.username})
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="p-16 text-center text-sm text-gray-500">Loading analytics data...</div>
      ) : error || !analytics ? (
        <div className="p-12 text-center text-sm text-rose-600">Failed to load analytics data.</div>
      ) : (
        <>
          {/* Totals Tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Total Revenue
                </span>
                <DollarSign className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-bold text-gray-900 mt-2">
                {formatMoney(analytics.totals.revenue)}
              </div>
              <div className="text-xs text-gray-400 mt-1">Active sales only</div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Sales Count
                </span>
                <ShoppingBag className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-2xl font-bold text-gray-900 mt-2">
                {analytics.totals.salesCount}
              </div>
              <div className="text-xs text-gray-400 mt-1">Transactions completed</div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Units Sold
                </span>
                <Package className="w-4 h-4 text-purple-600" />
              </div>
              <div className="text-2xl font-bold text-gray-900 mt-2">
                {analytics.totals.units}
              </div>
              <div className="text-xs text-gray-400 mt-1">Physical product items</div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Average Sale
                </span>
                <TrendingUp className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-2xl font-bold text-gray-900 mt-2">
                {formatMoney(analytics.totals.avgSaleValue)}
              </div>
              <div className="text-xs text-gray-400 mt-1">Per transaction ticket</div>
            </div>
          </div>

          {/* Revenue By Day Chart */}
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-xs space-y-4">
            <div>
              <h3 className="text-base font-bold text-gray-900">Revenue By Day</h3>
              <p className="text-xs text-gray-500">Daily sales revenue trend (Asia/Kathmandu)</p>
            </div>

            {chartData.length === 0 ? (
              <div className="py-16 text-center text-sm text-gray-400">
                No active sales data in the selected date range.
              </div>
            ) : (
              <div className="h-72 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: '#6b7280' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#6b7280' }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(val) => `Rs ${val.toLocaleString()}`}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const item = payload[0].payload;
                          return (
                            <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-md text-xs space-y-1">
                              <div className="font-semibold text-gray-900">{item.fullDate}</div>
                              <div className="text-emerald-600 font-bold">
                                Revenue: {formatMoney(item.revenue)}
                              </div>
                              <div className="text-gray-500">
                                Transactions: {item.salesCount}
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="rupees" fill="#059669" radius={[4, 4, 0, 0]} maxBarSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Leaderboard and Payment Method Split */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Seller Leaderboard Table (2 cols) */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden flex flex-col">
              <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <Award className="w-5 h-5 text-amber-500" />
                    Seller Leaderboard
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Ranking of field representatives by total sales revenue
                  </p>
                </div>
              </div>

              {analytics.bySeller.length === 0 ? (
                <div className="p-12 text-center text-sm text-gray-400">
                  No sales recorded by any seller in this period.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-gray-600">
                    <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500 border-b border-gray-200">
                      <tr>
                        <th className="px-5 py-3">Rank & Seller</th>
                        <th className="px-4 py-3 text-center">Sales</th>
                        <th className="px-4 py-3 text-center">Units</th>
                        <th className="px-4 py-3 text-right">Avg Ticket</th>
                        <th className="px-5 py-3 text-right">Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {analytics.bySeller.map((row, idx) => (
                        <tr key={row.seller.id} className="hover:bg-gray-50/75 transition-colors">
                          <td className="px-5 py-3.5 flex items-center gap-3">
                            <span
                              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                                idx === 0
                                  ? 'bg-amber-100 text-amber-700'
                                  : idx === 1
                                  ? 'bg-gray-200 text-gray-700'
                                  : idx === 2
                                  ? 'bg-amber-700/20 text-amber-800'
                                  : 'bg-gray-100 text-gray-500'
                              }`}
                            >
                              {idx + 1}
                            </span>
                            <div>
                              <div className="font-semibold text-gray-900">
                                {row.seller.displayName}
                              </div>
                              <div className="text-xs text-gray-400 font-mono">
                                @{row.seller.username}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-center font-medium text-gray-700">
                            {row.salesCount}
                          </td>
                          <td className="px-4 py-3.5 text-center font-medium text-gray-700">
                            {row.units}
                          </td>
                          <td className="px-4 py-3.5 text-right font-medium text-gray-700">
                            {formatMoney(row.avgSaleValue)}
                          </td>
                          <td className="px-5 py-3.5 text-right font-bold text-gray-900">
                            {formatMoney(row.revenue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Payment Method Split (1 col) */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-5 flex flex-col justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-indigo-500" />
                  Payment Methods
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Breakdown by customer payment preference
                </p>

                <div className="mt-6 space-y-4">
                  {analytics.byPaymentMethod.length === 0 ? (
                    <div className="py-8 text-center text-xs text-gray-400">
                      No payment data available.
                    </div>
                  ) : (
                    analytics.byPaymentMethod.map((pm) => {
                      const pmRev = BigInt(pm.revenue);
                      const pct =
                        totalPaymentPaisa > 0n
                          ? Number((pmRev * 100n) / totalPaymentPaisa)
                          : 0;

                      return (
                        <div key={pm.method} className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-gray-800">{pm.method}</span>
                            <span className="text-gray-500 font-mono">
                              {formatMoney(pm.revenue)} ({pct}%)
                            </span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-2 rounded-full ${
                                pm.method === 'CASH'
                                  ? 'bg-emerald-500'
                                  : pm.method === 'ESEWA'
                                  ? 'bg-green-600'
                                  : pm.method === 'KHALTI'
                                  ? 'bg-purple-600'
                                  : 'bg-blue-500'
                              }`}
                              style={{ width: `${Math.min(100, pct)}%` }}
                            />
                          </div>
                          <div className="text-2xs text-gray-400 text-right">
                            {pm.count} transactions
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Top 10 Products Table */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Package className="w-5 h-5 text-emerald-600" />
                Top 10 Products Sold
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Highest moving product catalog items ranked by units sold
              </p>
            </div>

            {analytics.topProducts.length === 0 ? (
              <div className="p-12 text-center text-sm text-gray-400">
                No products sold in this period.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-600">
                  <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500 border-b border-gray-200">
                    <tr>
                      <th className="px-5 py-3">Rank</th>
                      <th className="px-5 py-3">Product Name</th>
                      <th className="px-5 py-3 text-center">Units Sold</th>
                      <th className="px-5 py-3 text-right">Total Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {analytics.topProducts.map((p, idx) => (
                      <tr key={p.productName} className="hover:bg-gray-50/75 transition-colors">
                        <td className="px-5 py-3.5 font-bold text-gray-400 text-xs">{idx + 1}</td>
                        <td className="px-5 py-3.5 font-semibold text-gray-900">{p.productName}</td>
                        <td className="px-5 py-3.5 text-center font-bold text-emerald-700">
                          {p.units}
                        </td>
                        <td className="px-5 py-3.5 text-right font-bold text-gray-900">
                          {formatMoney(p.revenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
