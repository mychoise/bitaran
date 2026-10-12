import React from 'react';

interface StatusBadgeProps {
  status: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const getStyle = (s: string): string => {
    switch (s) {
      // Org status
      case 'APPROVED':
      case 'ACTIVE':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'PENDING':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'SUSPENDED':
      case 'DISABLED':
      case 'VOIDED':
        return 'bg-rose-50 text-rose-700 border-rose-200';

      // Order status
      case 'PAID':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'CONFIRMED':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'READY_FOR_PICKUP':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'IN_DELIVERY':
      case 'IN_TRANSIT':
      case 'PICKED_UP':
        return 'bg-cyan-50 text-cyan-700 border-cyan-200';
      case 'DELIVERED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'PAYMENT_PENDING':
      case 'PICKUP_PENDING':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'PAYMENT_FAILED':
      case 'CANCELLED':
      case 'FAILED':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'REJECTED_REFUND_PENDING':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'REFUNDED':
        return 'bg-gray-100 text-gray-700 border-gray-300';
      case 'DRAFT':
        return 'bg-gray-50 text-gray-600 border-gray-200';

      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const formatText = (s: string): string => {
    return s.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStyle(
        status,
      )}`}
    >
      {formatText(status)}
    </span>
  );
};
