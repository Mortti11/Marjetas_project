import React from 'react';

/**
 * StatusPill
 * Props: text, variant ('normal' | 'alert' | 'success')
 */
const variantStyles = {
  // Normal conditions pill per palette: text #22C55E on #ECFDF3
  normal: 'bg-[#ECFDF3] text-[#22C55E] border-green-200',
  alert: 'bg-red-100 text-red-700 border-red-200',
  success: 'bg-emerald-100 text-emerald-700 border-emerald-200'
};

export default function StatusPill({ text, variant = 'normal' }) {
  const cls = variantStyles[variant] || variantStyles.normal;
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${cls}`}>{text}</span>
  );
}
