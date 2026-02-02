import React from 'react';

/**
 * KpiCard
 * Props: label, value, subtext, icon, iconBgClass, iconColorClass
 * Layout: icon circle on left, metric stack on right.
 */
export default function KpiCard({
  label,
  value,
  subtext,
  icon,
  variant // 'temp' | 'humidity' | 'rain' | 'sensors'
}) {
  const variantClass = variant ? `kpi-card--${variant}` : '';
  return (
    <div className={`kpi-card ${variantClass}`}>
      {icon && (
        <div className={`kpi-icon kpi-icon--${variant || 'generic'}`}>{icon}</div>
      )}
      <div className="kpi-main">
        <div className="kpi-value">{value}</div>
        <div className="kpi-label">{label}</div>
        {subtext && <div className="kpi-subtext">{subtext}</div>}
      </div>
    </div>
  );
}
