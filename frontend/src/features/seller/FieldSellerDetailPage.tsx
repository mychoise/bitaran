import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { formatMoney } from '../../lib/money';
import { StatusBadge } from '../../components/StatusBadge';
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
  ArrowLeft,
  Calendar,
  ShoppingBag,
  TrendingUp,
  KeyRound,
  Power,
  Copy,
  Check,
  AlertTriangle,
  X,
  User,
  Save,
  Ban,
  Clock,
} from 'lucide-react';

interface RevenueDay {
  date: string;
  revenue: string;
  salesCount: number;
}

interface SellerDetail {
  id: string;
  userId: string;
  orgId: string;
  displayName: string;
  phone: string | null;
  status: 'ACTIVE' | 'DISABLED';
  username: string;
  createdAt: string;
  overview: {
    today: string;
    thisMonth: string;
    toDate: string;
    salesCount: number;
    averageSale: string;
    revenueByDay: RevenueDay[];
  };
}

interface SaleItem {
  id: string;
  saleId: string;
  variantId: string;
  nameSnapshot: string;
  skuSnapshot: string;
  unitPricePaisa: number;
  qty: number;
}

interface FieldSale {
  id: string;
  orgId: string;
  fieldSellerId: string;
  sellerName: string;
  customerName: string | null;
  customerPhone: string | null;
  paymentMethod: string;
  totalPaisa: string;
  status: 'ACTIVE' | 'VOIDED';
  voidReason: string | null;
  voidedByUserId: string | null;
  voidedAt: string | null;
  note: string | null;
  soldAt: string;
  createdAt: string;
  items: SaleItem[];
}

export const FieldSellerDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'overview' | 'sales' | 'account'>('overview');

  // Account editing state
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [accountSuccessMsg, setAccountSuccessMsg] = useState<string | null>(null);

  // Modals state
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [selectedSale, setSelectedSale] = useState<FieldSale | null>(null);
  const [saleToVoid, setSaleToVoid] = useState<FieldSale | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voidError, setVoidError] = useState<string | null>(null);

  // Sales tab filters
  const [salesStatus, setSalesStatus] = useState<string>('ALL');

  // 1. Fetch Seller Data
  const {
    data: seller,
    isLoading: sellerLoading,
    error: sellerError,
  } = useQuery<SellerDetail>({
    queryKey: ['seller-field-seller', id],
    queryFn: async () => {
      const data = await api.get<SellerDetail>(`/seller/field-sellers/${id}`);
      setEditName(data.displayName);
      setEditPhone(data.phone || '');
      return data;
    },
    enabled: !!id,
  });

  // 2. Fetch Sales for Sales Tab
  const { data: sales = [], isLoading: salesLoading } = useQuery<FieldSale[]>({
    queryKey: ['seller-field-sales', id, salesStatus],
    queryFn: () => {
      const params = new URLSearchParams();
      if (id) params.set('fieldSellerId', id);
      if (salesStatus !== 'ALL') params.set('status', salesStatus);
      return api.get<FieldSale[]>(`/seller/field-sales?${params.toString()}`);
    },
    enabled: !!id && activeTab === 'sales',
  });

  // 3. Mutations
  const updateProfileMutation = useMutation({
    mutationFn: (data: { displayName?: string; phone?: string | null }) =>
      api.patch(`/seller/field-sellers/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seller-field-seller', id] });
      queryClient.invalidateQueries({ queryKey: ['seller-field-sellers'] });
      setAccountSuccessMsg('Profile updated successfully');
      setTimeout(() => setAccountSuccessMsg(null), 3500);
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: (action: 'disable' | 'enable') =>
      api.post(`/seller/field-sellers/${id}/${action}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seller-field-seller', id] });
      queryClient.invalidateQueries({ queryKey: ['seller-field-sellers'] });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: () =>
      api.post<{ temporaryPassword: string }>(`/seller/field-sellers/${id}/reset-password`, {}),
    onSuccess: (res) => {
      setTempPassword(res.temporaryPassword);
      queryClient.invalidateQueries({ queryKey: ['seller-field-seller', id] });
    },
  });

  const voidSaleMutation = useMutation({
    mutationFn: ({ saleId, reason }: { saleId: string; reason: string }) =>
      api.post(`/seller/field-sales/${saleId}/void`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seller-field-sales', id] });
      queryClient.invalidateQueries({ queryKey: ['seller-field-seller', id] });
      setSaleToVoid(null);
      setVoidReason('');
      setVoidError(null);
      if (selectedSale) {
        setSelectedSale((prev) => (prev ? { ...prev, status: 'VOIDED', voidReason } : null));
      }
    },
    onError: (err: any) => {
      setVoidError(err.message || 'Failed to void sale');
    },
  });

  const handleCopyPassword = () => {
    if (!tempPassword) return;
    navigator.clipboard.writeText(tempPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleVoidSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!saleToVoid) return;
    const trimmed = voidReason.trim();
    if (trimmed.length < 3 || trimmed.length > 200) {
      setVoidError('Reason must be between 3 and 200 characters');
      return;
    }
    voidSaleMutation.mutate({ saleId: saleToVoid.id, reason: trimmed });
  };

  if (sellerLoading) {
    return <div className="p-12 text-center text-sm text-gray-500">Loading seller profile...</div>;
  }

  if (sellerError || !seller) {
    return (
      <div className="p-8 text-center space-y-4">
        <p className="text-sm text-rose-600">Field seller not found or failed to load.</p>
        <Link to="/seller/field-sellers" className="text-sm text-emerald-600 hover:underline">
          Return to field sellers
        </Link>
      </div>
    );
  }

  // Prep chart data
  const chartData = seller.overview.revenueByDay.map((d) => ({
    date: d.date.slice(5), // 'MM-DD'
    fullDate: d.date,
    rupees: Number(BigInt(d.revenue) / 100n),
    revenue: d.revenue,
    salesCount: d.salesCount,
  }));

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/seller/field-sellers"
            className="p-2 text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                {seller.displayName}
              </h1>
              <StatusBadge status={seller.status} />
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
              <span className="font-mono text-emerald-700 font-semibold">@{seller.username}</span>
              {seller.phone && <span>• {seller.phone}</span>}
              <span>• Added on {new Date(seller.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('account')}
            className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Account Settings
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-8">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`pb-3 text-sm font-semibold transition-colors border-b-2 cursor-pointer ${
              activeTab === 'overview'
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Overview
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sales')}
            className={`pb-3 text-sm font-semibold transition-colors border-b-2 cursor-pointer ${
              activeTab === 'sales'
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Sales History
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('account')}
            className={`pb-3 text-sm font-semibold transition-colors border-b-2 cursor-pointer ${
              activeTab === 'account'
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Account & Security
          </button>
        </nav>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Key Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Sold Today
                </span>
                <Clock className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-xl font-bold text-gray-900 mt-2">
                {formatMoney(seller.overview.today)}
              </div>
              <div className="text-xs text-gray-400 mt-1">Live Kathmandu today</div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Sold This Month
                </span>
                <Calendar className="w-4 h-4 text-blue-500" />
              </div>
              <div className="text-xl font-bold text-gray-900 mt-2">
                {formatMoney(seller.overview.thisMonth)}
              </div>
              <div className="text-xs text-gray-400 mt-1">Current calendar month</div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Sold To Date
                </span>
                <ShoppingBag className="w-4 h-4 text-purple-500" />
              </div>
              <div className="text-xl font-bold text-gray-900 mt-2">
                {formatMoney(seller.overview.toDate)}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                {seller.overview.salesCount} active recorded sales
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Average Sale
                </span>
                <TrendingUp className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-xl font-bold text-gray-900 mt-2">
                {formatMoney(seller.overview.averageSale)}
              </div>
              <div className="text-xs text-gray-400 mt-1">Per completed sale</div>
            </div>
          </div>

          {/* Revenue By Day Chart (Past 14 Days) */}
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-900">Revenue (Past 14 Days)</h3>
                <p className="text-xs text-gray-500">Daily sales revenue in Rs (Asia/Kathmandu)</p>
              </div>
            </div>

            {chartData.length === 0 ? (
              <div className="py-16 text-center text-sm text-gray-400">
                No active sales recorded in the past 14 days.
              </div>
            ) : (
              <div className="h-64 w-full pt-2">
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
                                Sales: {item.salesCount}
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="rupees" fill="#059669" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: SALES HISTORY */}
      {activeTab === 'sales' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <label className="text-xs font-semibold text-gray-500 uppercase">Status:</label>
              <select
                value={salesStatus}
                onChange={(e) => setSalesStatus(e.target.value)}
                className="text-xs border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
              >
                <option value="ALL">All Sales</option>
                <option value="ACTIVE">Active Only</option>
                <option value="VOIDED">Voided Only</option>
              </select>
            </div>
            <div className="text-xs text-gray-500 font-medium">
              Found {sales.length} sales
            </div>
          </div>

          {/* Sales Table */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
            {salesLoading ? (
              <div className="p-12 text-center text-sm text-gray-500">Loading sales history...</div>
            ) : sales.length === 0 ? (
              <div className="p-12 text-center text-sm text-gray-500">
                No sales recorded for this seller matching filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-600">
                  <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500 border-b border-gray-200">
                    <tr>
                      <th className="px-5 py-3.5">Sold At</th>
                      <th className="px-5 py-3.5">Customer</th>
                      <th className="px-5 py-3.5 text-center">Items</th>
                      <th className="px-5 py-3.5">Payment</th>
                      <th className="px-5 py-3.5 text-right">Total</th>
                      <th className="px-5 py-3.5">Status</th>
                      <th className="px-5 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {sales.map((sale) => (
                      <tr
                        key={sale.id}
                        className={`hover:bg-gray-50/75 transition-colors cursor-pointer ${
                          sale.status === 'VOIDED' ? 'bg-rose-50/30' : ''
                        }`}
                        onClick={() => setSelectedSale(sale)}
                      >
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="font-medium text-gray-900">
                            {new Date(sale.soldAt).toLocaleDateString()}
                          </div>
                          <div className="text-xs text-gray-400">
                            {new Date(sale.soldAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="font-medium text-gray-900">
                            {sale.customerName || 'Walk-in Customer'}
                          </div>
                          {sale.customerPhone && (
                            <div className="text-xs text-gray-400 font-mono">
                              {sale.customerPhone}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-4 text-center">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                            {sale.items?.length || 0} items
                          </span>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-xs font-medium text-gray-700">
                          {sale.paymentMethod}
                        </td>
                        <td className="px-5 py-4 text-right whitespace-nowrap">
                          <span
                            className={`font-semibold ${
                              sale.status === 'VOIDED'
                                ? 'text-gray-400 line-through'
                                : 'text-gray-900'
                            }`}
                          >
                            {formatMoney(sale.totalPaisa)}
                          </span>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <StatusBadge status={sale.status} />
                        </td>
                        <td className="px-5 py-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedSale(sale)}
                              className="px-2.5 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors shadow-2xs"
                            >
                              Details
                            </button>
                            {sale.status === 'ACTIVE' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSaleToVoid(sale);
                                  setVoidReason('');
                                  setVoidError(null);
                                }}
                                className="px-2.5 py-1 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-md hover:bg-rose-100 transition-colors shadow-2xs"
                              >
                                Void
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: ACCOUNT & SECURITY */}
      {activeTab === 'account' && (
        <div className="space-y-6 max-w-3xl">
          {/* Edit Profile Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <User className="w-4 h-4 text-gray-500" />
              Edit Seller Details
            </h3>

            {accountSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600" />
                {accountSuccessMsg}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateProfileMutation.mutate({
                  displayName: editName.trim(),
                  phone: editPhone.trim() ? editPhone.trim() : null,
                });
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Display Name
                  </label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    disabled
                    value={`@${seller.username}`}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-500 font-mono cursor-not-allowed"
                  />
                  <span className="text-2xs text-gray-400 mt-0.5 block">
                    Usernames cannot be changed once assigned.
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="e.g. 9841234567"
                  className="w-full sm:w-1/2 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={updateProfileMutation.isPending || !editName}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors shadow-xs disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {updateProfileMutation.isPending ? 'Saving...' : 'Save Profile Changes'}
                </button>
              </div>
            </form>
          </div>

          {/* Password Reset Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-amber-500" />
              Reset Seller Password
            </h3>
            <p className="text-xs text-gray-500">
              Generate a new temporary password for this field seller. Their active sessions will be
              revoked immediately and they will be prompted to choose a new password on login.
            </p>

            {tempPassword ? (
              <div className="space-y-4 pt-2">
                <div className="p-4 bg-amber-50 border-2 border-dashed border-amber-300 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-amber-800 uppercase tracking-wide">
                      New Temporary Password
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyPassword}
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-600 text-white rounded-md text-xs font-medium hover:bg-amber-700 transition-colors shadow-2xs"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5" /> Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" /> Copy
                        </>
                      )}
                    </button>
                  </div>
                  <div className="font-mono text-xl font-bold text-gray-900 bg-white p-2.5 rounded-lg border border-amber-200 text-center tracking-widest select-all">
                    {tempPassword}
                  </div>
                </div>

                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2.5 text-xs text-yellow-800">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-yellow-600 mt-0.5" />
                  <div>
                    Share this password securely with the seller. They will be required to change it
                    on first login. It will not be shown again.
                  </div>
                </div>
              </div>
            ) : (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => resetPasswordMutation.mutate()}
                  disabled={resetPasswordMutation.isPending}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors shadow-xs disabled:opacity-50"
                >
                  <KeyRound className="w-4 h-4" />
                  {resetPasswordMutation.isPending
                    ? 'Generating Password...'
                    : 'Generate New Temporary Password'}
                </button>
              </div>
            )}
          </div>

          {/* Account Status Card (Disable / Enable) */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Power className="w-4 h-4 text-gray-700" />
              Account Status & Access
            </h3>
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
              <div>
                <div className="text-sm font-semibold text-gray-900">
                  Current Status: <StatusBadge status={seller.status} />
                </div>
                <p className="text-xs text-gray-500 mt-1 max-w-md">
                  {seller.status === 'ACTIVE'
                    ? 'Disabling this seller will immediately block their login and prevent recording new sales.'
                    : 'Re-enabling this seller allows them to log in again and record sales.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  toggleStatusMutation.mutate(seller.status === 'ACTIVE' ? 'disable' : 'enable')
                }
                disabled={toggleStatusMutation.isPending}
                className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors shadow-xs disabled:opacity-50 ${
                  seller.status === 'ACTIVE'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {toggleStatusMutation.isPending
                  ? 'Processing...'
                  : seller.status === 'ACTIVE'
                  ? 'Disable Account'
                  : 'Enable Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sale Detail Modal */}
      {selectedSale && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  Sale Details
                  <StatusBadge status={selectedSale.status} />
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Recorded {new Date(selectedSale.soldAt).toLocaleString()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSale(null)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {selectedSale.status === 'VOIDED' && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl space-y-1">
                <div className="text-xs font-bold text-rose-800 uppercase flex items-center gap-1.5">
                  <Ban className="w-4 h-4 text-rose-600" />
                  This sale was voided
                </div>
                <p className="text-xs text-rose-700 font-medium">
                  Reason: &quot;{selectedSale.voidReason}&quot;
                </p>
                {selectedSale.voidedAt && (
                  <p className="text-2xs text-rose-500">
                    Voided on {new Date(selectedSale.voidedAt).toLocaleString()}
                  </p>
                )}
              </div>
            )}

            {/* Customer & Payment Meta */}
            <div className="grid grid-cols-2 gap-3 p-3.5 bg-gray-50 rounded-xl text-xs">
              <div>
                <span className="text-gray-400 block">Customer Name</span>
                <span className="font-semibold text-gray-800">
                  {selectedSale.customerName || 'Walk-in'}
                </span>
              </div>
              <div>
                <span className="text-gray-400 block">Customer Phone</span>
                <span className="font-mono text-gray-800">
                  {selectedSale.customerPhone || '—'}
                </span>
              </div>
              <div>
                <span className="text-gray-400 block">Payment Method</span>
                <span className="font-semibold text-emerald-700">
                  {selectedSale.paymentMethod}
                </span>
              </div>
              <div>
                <span className="text-gray-400 block">Field Seller</span>
                <span className="font-semibold text-gray-800">
                  {selectedSale.sellerName || seller.displayName}
                </span>
              </div>
            </div>

            {selectedSale.note && (
              <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-200/60 text-xs">
                <span className="font-semibold text-amber-900 block mb-0.5">Note:</span>
                <span className="text-amber-800">{selectedSale.note}</span>
              </div>
            )}

            {/* Line Items Snapshot */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Items ({selectedSale.items?.length || 0})
              </h4>
              <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
                {selectedSale.items?.map((item) => (
                  <div key={item.id} className="p-3 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-semibold text-gray-900">{item.nameSnapshot}</div>
                      <div className="text-gray-400 font-mono mt-0.5">
                        SKU: {item.skuSnapshot} • {formatMoney(item.unitPricePaisa)} × {item.qty}
                      </div>
                    </div>
                    <div className="font-bold text-gray-900 text-sm">
                      {formatMoney(BigInt(item.unitPricePaisa) * BigInt(item.qty))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Total Footer */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
              <span className="text-sm font-bold text-gray-700">Grand Total</span>
              <span className="text-lg font-black text-emerald-700">
                {formatMoney(selectedSale.totalPaisa)}
              </span>
            </div>

            {/* Actions in Modal */}
            <div className="flex items-center justify-between pt-2">
              {selectedSale.status === 'ACTIVE' ? (
                <button
                  type="button"
                  onClick={() => {
                    setSaleToVoid(selectedSale);
                    setVoidReason('');
                    setVoidError(null);
                  }}
                  className="px-4 py-2 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100"
                >
                  Void Sale
                </button>
              ) : (
                <div />
              )}
              <button
                type="button"
                onClick={() => setSelectedSale(null)}
                className="px-4 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Void Confirmation Modal */}
      {saleToVoid && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Ban className="w-5 h-5 text-rose-600" />
                Void Sale
              </h3>
              <button
                type="button"
                onClick={() => setSaleToVoid(null)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {voidError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
                {voidError}
              </div>
            )}

            <p className="text-sm text-gray-600">
              Are you sure you want to void this sale of{' '}
              <span className="font-bold text-gray-900">{formatMoney(saleToVoid.totalPaisa)}</span>?
            </p>
            <p className="text-xs text-gray-500">
              Voided sales remain visible in audit logs but are completely excluded from all totals,
              seller earnings, and analytics. A mandatory reason is required.
            </p>

            <form onSubmit={handleVoidSubmit} className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Reason for voiding <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder="e.g. Customer returned items immediately / duplicate entry error"
                  className="w-full p-3 text-sm border border-gray-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                />
                <span className="text-2xs text-gray-400">3 to 200 characters</span>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSaleToVoid(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={voidSaleMutation.isPending || voidReason.trim().length < 3}
                  className="px-4 py-2 text-sm font-medium text-white bg-rose-600 rounded-lg hover:bg-rose-700 disabled:opacity-50 shadow-xs"
                >
                  {voidSaleMutation.isPending ? 'Voiding...' : 'Confirm Void'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
