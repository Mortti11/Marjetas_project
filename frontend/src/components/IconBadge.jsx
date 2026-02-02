import React from 'react';
import './IconBadge.css';

/**
 * IconBadge - A reusable component that renders a lucide icon in a rounded badge
 * @param {React.Component} icon - Lucide icon component
 * @param {string} color - Color variant: 'blue', 'green', 'orange', 'purple', 'slate'
 * @param {string} size - Size variant: 'sm', 'md', 'lg'
 */
export default function IconBadge({ icon: Icon, color = 'blue', size = 'md' }) {
  return (
    <div className={`icon-badge icon-badge--${color} icon-badge--${size}`}>
      <Icon className="icon-badge__icon" />
    </div>
  );
}
