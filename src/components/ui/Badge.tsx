// ============================================
// UI Components - Badge
// ============================================

import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'outline' | 'destructive';
  size?: 'sm' | 'md';
  className?: string;
  style?: React.CSSProperties;
}

export function Badge({
  children,
  variant = 'default',
  size = 'md',
  className = '',
  style,
}: BadgeProps) {
  const variantStyles = {
    default: 'bg-gray-100 text-gray-700',
    success: 'bg-green-100 text-green-700',
    warning: 'bg-yellow-100 text-yellow-700',
    danger: 'bg-red-100 text-red-700',
    info: 'bg-blue-100 text-blue-700',
    outline: 'bg-transparent border border-gray-300 text-gray-700',
    destructive: 'bg-red-100 text-red-700',
  };

  const sizeStyles = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
  };

  return (
    <span
      className={`
        inline-flex items-center font-medium rounded-full
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${className}
      `}
      style={style}
    >
      {children}
    </span>
  );
}

// Status badge for appointments, queue items, etc.
interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const statusConfig: Record<string, { variant: BadgeProps['variant']; label: string }> = {
    scheduled: { variant: 'info', label: 'Scheduled' },
    confirmed: { variant: 'success', label: 'Confirmed' },
    'in-progress': { variant: 'warning', label: 'In Progress' },
    completed: { variant: 'success', label: 'Completed' },
    cancelled: { variant: 'danger', label: 'Cancelled' },
    'no-show': { variant: 'danger', label: 'No Show' },
    waiting: { variant: 'info', label: 'Waiting' },
    'in-consultation': { variant: 'warning', label: 'In Consultation' },
    skipped: { variant: 'default', label: 'Skipped' },
    paid: { variant: 'success', label: 'Paid' },
    pending: { variant: 'warning', label: 'Pending' },
    refunded: { variant: 'default', label: 'Refunded' },
  };

  const config = statusConfig[status] || { variant: 'default', label: status };

  return <Badge variant={config.variant}>{config.label}</Badge>;
}
