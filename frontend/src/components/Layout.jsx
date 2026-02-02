import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Thermometer,
  CloudRain,
  LineChart,
  CloudLightning,
  Menu,
} from 'lucide-react';
import './Layout.css';

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const navItems = [
    { to: '/', label: 'Overview', icon: LayoutDashboard },
    { to: '/lht', label: 'LHT Sensors', icon: Thermometer },
    { to: '/ws100', label: 'WS100 Sensors', icon: CloudRain },
    { to: '/analyze', label: 'Analyze', icon: LineChart },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <div className="app-root">
      <header className="top-bar">
        <button
          className="hamburger"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label="Toggle menu"
        >
          <Menu size={24} />
        </button>
        <div className="top-bar-title">Jyväskylä Weather & Sensor Dashboard</div>
      </header>

      <div className="app-body">
        <aside className={`sidebar-container sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="sidebar-section-label">Navigation</div>
          <nav className="sidebar-nav" aria-label="Primary navigation">
            {navItems.map(({ to, label, icon: Icon }) => {
              const active = isActive(to);
              return (
                <Link
                  key={to}
                  to={to}
                  className={active ? 'sidebar-item sidebar-item--active' : 'sidebar-item'}
                  onClick={() => setSidebarOpen(false)}
                >
                  <span className="sidebar-item-icon" aria-hidden="true">
                    <Icon size={18} strokeWidth={1.8} />
                  </span>
                  <span className="sidebar-item-label">{label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="page-shell">
          <div className="page-inner">
            {children}
          </div>
        </main>
      </div>

      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
