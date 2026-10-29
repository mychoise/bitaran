import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { Truck, Clock, Ban, ArrowRight } from 'lucide-react';

export const AdminDashboardPage: React.FC = () => {
  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => api.get<any>('/admin/dashboard'),
  });

  const { data: pendingOrgs = [], isLoading: orgsLoading } = useQuery({
    queryKey: ['admin-approvals'],
    queryFn: () => api.get<any[]>('/admin/orgs?status=PENDING'),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Platform Admin Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Platform-level metrics, pending business approvals, and delivery logistics
        </p>
      </div>

      {/* Four count tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Pending approvals
            </p>
            <p className="text-2xl font-extrabold text-amber-600 mt-1">
              {stats?.pendingApprovals ?? pendingOrgs.length}
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Orders to ship
            </p>
            <p className="text-2xl font-extrabold text-gray-900 mt-1">
              {stats?.ordersToShip ?? 0}
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Truck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Active shipments
            </p>
            <p className="text-2xl font-extrabold text-gray-900 mt-1">
              {stats?.activeShipments ?? 0}
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
            <Truck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Suspended businesses
            </p>
            <p className="text-2xl font-extrabold text-rose-600 mt-1">
              {stats?.suspendedBusinesses ?? 0}
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
            <Ban className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Waiting for approval table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">Waiting for approval</h2>
          <Link
            to="/admin/approvals"
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center space-x-1"
          >
            <span>View all approvals</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {orgsLoading ? (
          <div className="p-8 text-center text-gray-400">Loading pending accounts...</div>
        ) : pendingOrgs.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            No businesses waiting for approval.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700">Business</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700">PAN Number</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700">Type</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700">Registered</th>
                  <th className="px-6 py-3 text-right font-semibold text-gray-700">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {pendingOrgs.slice(0, 5).map((org: any) => (
                  <tr key={org.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3.5 font-semibold text-gray-900">{org.name}</td>
                    <td className="px-6 py-3.5 font-mono text-xs text-gray-600">
                      {org.panNumber || '—'}
                    </td>
                    <td className="px-6 py-3.5 text-xs text-gray-700">
                      {org.canBuy && org.canSell ? 'Buyer & Seller' : org.canSell ? 'Seller' : 'Buyer'}
                    </td>
                    <td className="px-6 py-3.5 text-xs text-gray-500">
                      {org.createdAt && !Number.isNaN(new Date(org.createdAt).getTime())
                        ? new Date(org.createdAt).toLocaleDateString()
                        : '—'}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <Link
                        to="/admin/approvals"
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold"
                      >
                        Review
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
