import React from 'react';

/**
 * PageHeader component
 * Props:
 *  - title: string
 *  - description: string
 *  - rightContent: React node (optional)
 */
export default function PageHeader({ title, description, rightContent }) {
  return (
    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
      <div className="flex-1 min-w-0">
        <h1 className="text-[30px] leading-tight font-semibold text-slate-900 tracking-tight">{title}</h1>
        {description && (
          <p className="mt-1 text-base text-slate-600 max-w-3xl">{description}</p>
        )}
      </div>
      {rightContent && (
        <div className="flex-shrink-0 flex items-start">
          {rightContent}
        </div>
      )}
    </div>
  );
}
