import React from 'react';

/**
 * ChartCard
 * Props: title, description, actions, children
 */
export default function ChartCard({ title, description, actions, children }) {
  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <div className="chart-card-titles">
          <h2 className="chart-card-title">{title}</h2>
          {description && <p className="chart-card-subtitle">{description}</p>}
        </div>
        {actions && <div className="chart-card-actions">{actions}</div>}
      </div>
      <div className="chart-card-body">
        {children}
      </div>
    </div>
  );
}
