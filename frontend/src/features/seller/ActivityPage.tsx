import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { formatMoney } from '../../lib/money';
import {
  History,
  Filter,
  User,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Tag,
  Boxes,
  Layers,
  Inbox,
  Users,
  Shield,
  Ban,
} from 'lucide-react';

interface AuditItem {
  id: string;
  actorId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  meta: Record<string, any> | null;
  createdAt: string;
}

interface ActivityResponse {
  items: AuditItem[];
  page: number;
  limit: number;
  total: number;
}

export const ActivityPage: React.FC = () => {
  const { activeOrg } = useAuth();

  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const queryParams = new URLSearchParams();
  queryParams.set('page', page.toString());
  if (actionFilter) queryParams.set('action', actionFilter);
  if (fromDate) queryParams.set('from', fromDate);
  if (toDate) queryParams.set('to', toDate);

  const { data, isLoading, error, refetch, isFetching } = useQuery<ActivityResponse>({
    queryKey: ['seller-activity', activeOrg?.orgId, page, actionFilter, fromDate, toDate],
    queryFn: () => api.get<ActivityResponse>(`/seller/activity?${queryParams.toString()}`),
    enabled: !!activeOrg?.canSell,
  });

  const items = data?.items || [];
  const total = data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / 25));

  const handleClearFilters = () => {
    setActionFilter('');
    setFromDate('');
    setToDate('');
    setPage(1);
  };

  const formatSummary = (item: AuditItem): React.ReactNode => {
    const meta = item.meta || {};

    switch (item.action) {
      case 'product.price_changed': {
        const oldPrice = meta.oldPricePaisa ? formatMoney(meta.oldPricePaisa) : '—';
        const newPrice = meta.newPricePaisa ? formatMoney(meta.newPricePaisa) : '—';
        return (
          <span>
            Price changed for variant <strong className="font-mono text-gray-900">{meta.sku || 'SKU'}</strong>:{' '}
            <span className="line-through text-gray-400">{oldPrice}</span>{' '}
            <ArrowRight className="w-3 h-3 inline mx-0.5 text-gray-400" />{' '}
            <strong className="text-amber-800">{newPrice}</strong>
          </span>
        );
      }
      case 'product.created':
        return <span>Created product: <strong className="text-gray-900">{meta.name || 'New Product'}</strong></span>;
      case 'product.updated':
        return <span>Updated product details for <strong className="text-gray-900">{meta.name || 'Product'}</strong></span>;
      case 'stock.adjusted': {
        const delta = meta.delta || 0;
        const deltaSign = delta > 0 ? `+${delta}` : `${delta}`;
        return (
          <span>
            Stock adjusted from <strong>{meta.qtyBefore ?? '—'}</strong> to{' '}
            <strong>{meta.qtyAfter ?? '—'}</strong> ({deltaSign})
            {meta.reason && <span className="text-gray-500"> • &ldquo;{meta.reason}&rdquo;</span>}
          </span>
        );
      }
      case 'team.member_created':
        return (
          <span>
            Added team member <strong className="text-gray-900">{meta.name}</strong> ({meta.email}) as{' '}
            <strong className="text-blue-700">{meta.role}</strong>
          </span>
        );
      case 'team.role_changed':
        return (
          <span>
            Changed role from <strong className="text-gray-700">{meta.oldRole}</strong>{' '}
            <ArrowRight className="w-3 h-3 inline mx-0.5 text-gray-400" />{' '}
            <strong className="text-blue-700">{meta.newRole}</strong>
          </span>
        );
      case 'team.member_updated':
        return <span>Updated team member profile ({meta.name || 'details'})</span>;
      case 'team.member_disabled':
        return <span className="text-rose-700 font-medium">Disabled team member account</span>;
      case 'team.member_enabled':
        return <span className="text-emerald-700 font-medium">Re-enabled team member account</span>;
      case 'team.password_reset':
        return <span>Generated temporary password for team member</span>;
      case 'fieldseller.created':
        return (
          <span>
            Created field seller <strong className="text-gray-900">{meta.displayName}</strong> (@{meta.username})
          </span>
        );
      case 'fieldseller.updated':
        return <span>Updated field seller details</span>;
      case 'fieldseller.disabled':
        return <span className="text-rose-700 font-medium">Disabled field seller account</span>;
      case 'fieldseller.enabled':
        return <span className="text-emerald-700 font-medium">Enabled field seller account</span>;
      case 'fieldseller.password_reset':
        return <span>Reset field seller password</span>;
      case 'fieldsale.voided':
        return (
          <span>
            Voided field sale ({meta.totalPaisa ? formatMoney(meta.totalPaisa) : ''}) • Reason:{' '}
            <strong className="text-rose-800">&ldquo;{meta.reason || 'No reason'}&rdquo;</strong>
          </span>
        );
      case 'order.accepted':
        return <span className="text-emerald-700 font-medium">Accepted incoming order</span>;
      case 'order.rejected':
        return <span className="text-rose-700 font-medium">Rejected incoming order (refund pending)</span>;
      case 'order.ready':
        return <span className="text-purple-700 font-medium">Marked order ready for pickup</span>;
      case 'order.refunded':
        return <span className="text-gray-800 font-medium">Marked order refund completed</span>;
      default:
        return <span className="text-gray-600">{item.action}</span>;
    }
  };

  const getActionBadge = (action: string) => {
    if (action.startsWith('product.price')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          <Tag className="w-3 h-3 text-amber-600" />
          Price Change
        </span>
      );
    }
    if (action.startsWith('product.')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">
          <Boxes className="w-3 h-3 text-gray-500" />
          Catalog
        </span>
      );
    }
    if (action.startsWith('stock.')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-semibold bg-cyan-50 text-cyan-700 border border-cyan-200">
          <Layers className="w-3 h-3 text-cyan-600" />
          Inventory
        </span>
      );
    }
    if (action.startsWith('team.')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
          <Shield className="w-3 h-3 text-blue-600" />
          Team
        </span>
      );
    }
    if (action.startsWith('fieldsale.voided')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
          <Ban className="w-3 h-3 text-rose-600" />
          Sale Voided
        </span>
      );
    }
    if (action.startsWith('fieldseller.')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <Users className="w-3 h-3 text-emerald-600" />
          Field Sellers
        </span>
      );
    }
    if (action.startsWith('order.')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
          <Inbox className="w-3 h-3 text-purple-600" />
          Orders
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-semibold bg-gray-50 text-gray-600 border border-gray-200">
        {action}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Business Activity Log</h1>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">
              {total} events
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            Immutable audit trail of pricing updates, inventory adjustments, orders, and team changes.
          </p>
        </div>

        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 shadow-2xs transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin text-gray-400' : 'text-gray-500'}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between text-xs font-bold text-gray-700 uppercase tracking-wider">
          <div className="flex items-center space-x-1.5">
            <Filter className="w-3.5 h-3.5 text-gray-400" />
            <span>Filter Activity</span>
          </div>
          {(actionFilter || fromDate || toDate) && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="text-2xs font-semibold text-blue-600 hover:text-blue-800 normal-case"
            >
              Clear filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-2xs font-semibold text-gray-500 mb-1">Action Type</label>
            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Actions</option>
              <optgroup label="Catalog & Pricing">
                <option value="product.price_changed">Price Changes (product.price_changed)</option>
                <option value="product.created">Product Created (product.created)</option>
                <option value="product.updated">Product Updated (product.updated)</option>
              </optgroup>
              <optgroup label="Inventory">
                <option value="stock.adjusted">Stock Adjustments (stock.adjusted)</option>
              </optgroup>
              <optgroup label="Team Management">
                <option value="team.member_created">Team Member Created</option>
                <option value="team.role_changed">Role Changed</option>
                <option value="team.member_disabled">Member Disabled</option>
                <option value="team.member_enabled">Member Enabled</option>
                <option value="team.password_reset">Password Reset</option>
              </optgroup>
              <optgroup label="Orders">
                <option value="order.accepted">Order Accepted</option>
                <option value="order.rejected">Order Rejected</option>
                <option value="order.ready">Order Ready for Pickup</option>
                <option value="order.refunded">Order Refunded</option>
              </optgroup>
              <optgroup label="Field Sellers">
                <option value="fieldseller.created">Field Seller Created</option>
                <option value="fieldseller.disabled">Field Seller Disabled</option>
                <option value="fieldseller.enabled">Field Seller Enabled</option>
                <option value="fieldsale.voided">Field Sale Voided</option>
              </optgroup>
            </select>
          </div>

          <div>
            <label className="block text-2xs font-semibold text-gray-500 mb-1">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-2xs font-semibold text-gray-500 mb-1">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-sm text-gray-500">Loading activity logs...</div>
        ) : error ? (
          <div className="p-8 text-center text-sm text-rose-600">Failed to load activity logs.</div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <History className="w-10 h-10 text-gray-300 mx-auto" />
            <h3 className="text-base font-bold text-gray-900">No activity logs found</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              {actionFilter || fromDate || toDate
                ? 'No events match the selected filters. Try widening your criteria.'
                : 'As you and your team perform operations (price edits, stock changes, order processing), they will be recorded here.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs divide-y divide-gray-200">
              <thead className="bg-gray-50/75 text-2xs font-bold text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Timestamp</th>
                  <th className="px-5 py-3.5">Actor</th>
                  <th className="px-5 py-3.5">Action</th>
                  <th className="px-5 py-3.5">Summary / Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-5 py-3.5 whitespace-nowrap text-gray-500 font-mono text-2xs">
                      {new Date(item.createdAt).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true,
                      })}
                    </td>

                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <div className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 font-bold flex items-center justify-center text-3xs border border-gray-200 shrink-0">
                          {item.actorName ? item.actorName.charAt(0).toUpperCase() : <User className="w-3 h-3" />}
                        </div>
                        <span className="font-semibold text-gray-900">
                          {item.actorName || item.actorEmail || 'System'}
                        </span>
                      </div>
                    </td>

                    <td className="px-5 py-3.5 whitespace-nowrap">
                      {getActionBadge(item.action)}
                    </td>

                    <td className="px-5 py-3.5 text-gray-700 leading-relaxed">
                      {formatSummary(item)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {total > 0 && (
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-gray-200 bg-gray-50/50 text-xs text-gray-500">
            <div>
              Showing <strong className="text-gray-900">{items.length}</strong> of{' '}
              <strong className="text-gray-900">{total}</strong> events
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 transition shadow-2xs"
                title="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-semibold px-2">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 transition shadow-2xs"
                title="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
