import React from 'react';

/**
 * FilterBar
 * A simple horizontal wrapper for filter / control elements.
 * Usage: <FilterBar><div className="filter-group">...</div></FilterBar>
 * Keeps spacing & responsive wrapping consistent across pages.
 */
export default function FilterBar({ children }) {
  return (
    <div className="filter-bar" role="region" aria-label="Filter controls">
      {children}
    </div>
  );
}
