import React from 'react';

export default function Badge({ children, variant = 'slate', size = 'sm', className = '' }) {
  const normalized = String(variant).toLowerCase();

  let variantStyles = 'bg-slate-100 text-slate-700 border-slate-200';

  if (['success', 'approved', 'active'].includes(normalized)) {
    variantStyles = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  } else if (['warning', 'pending'].includes(normalized)) {
    variantStyles = 'bg-amber-50 text-amber-700 border-amber-200';
  } else if (['danger', 'rejected', 'inactive'].includes(normalized)) {
    variantStyles = 'bg-rose-50 text-rose-700 border-rose-200';
  } else if (['info', 'primary', 'blue'].includes(normalized)) {
    variantStyles = 'bg-blue-50 text-blue-700 border-blue-200';
  } else if (['relative', 'retail', 'purple', 'indigo'].includes(normalized)) {
    variantStyles = 'bg-indigo-50 text-indigo-700 border-indigo-200';
  }

  const sizeStyles = {
    xs: 'px-2 py-0.5 text-[10px]',
    sm: 'px-2.5 py-1 text-xs',
    md: 'px-3 py-1 text-sm',
  };

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ${sizeStyles[size] || sizeStyles.sm} ${variantStyles} ${className}`}
    >
      {children}
    </span>
  );
}
