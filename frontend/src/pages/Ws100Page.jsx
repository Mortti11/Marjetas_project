import React, { useEffect, useState } from 'react';
import { Droplet, Clock, Activity, MapPin, ChevronDown, BarChart, PieChart, Clock3 } from 'lucide-react';
import { perLocationSummary, diffVsNetworkMean } from '../data/ws100MatrixData';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  PointElement,
  LineElement,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import './Pages.css';
import '../styles/matrix-card.css';
import '../styles/metric-tabs.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  PointElement,
  LineElement
);

export default function Ws100Page() {
  const [summaryData, setSummaryData] = useState(null);
  const [sensors, setSensors] = useState([]);
  const [selectedSensor, setSelectedSensor] = useState('Kotaniementie');

  // Dashboard State (using existing naming)
  const [startDate, setStartDate] = useState('2024-01-01');
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [aggregation, setAggregation] = useState('monthly'); // 'daily' or 'monthly'
  const [metric, setMetric] = useState('duration'); // 'duration', 'precip', 'share'

  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dashLoading, setDashLoading] = useState(false);
  const [error, setError] = useState(null);

  // UI state
  const [tableExpanded, setTableExpanded] = useState(false);
  const [matrixTab, setMatrixTab] = useState('perLocation'); // 'perLocation', 'vsMean', 'vsKotaniementie'
  const [visibleSeries, setVisibleSeries] = useState({
    Dry: true,
    Mix: true,
    Rain: true,
    Snow: true,
    Total: true
  });

  // Map aggregation to API freq parameter
  const getFreqParam = () => aggregation === 'daily' ? 'D' : 'MS';

  // Fetch initial summary and sensor list
  useEffect(() => {
    // Guard fetches and use relative URLs
    Promise.allSettled([
      fetch('/api/ws100/demo-summary').then(r => (r.ok ? r.json() : null)).catch(() => null),
      fetch('/api/ws100/list').then(r => (r.ok ? r.json() : null)).catch(() => null),
    ])
      .then((results) => {
        const [summaryRes, listRes] = results;
        const summary = summaryRes.status === 'fulfilled' ? summaryRes.value : null;
        const sensorList = listRes.status === 'fulfilled' ? listRes.value : null;

        setSummaryData(summary);
        setSensors((sensorList && sensorList.sensors) ? sensorList.sensors : []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load WS100 initial data', err);
        setLoading(false);
      });
  }, []);

  // Fetch dashboard data
  useEffect(() => {
    if (!selectedSensor) return;

    setDashLoading(true);
    const freq = getFreqParam();
    const url = `/api/ws100/dynamic-analysis?sensor=${encodeURIComponent(selectedSensor)}&start_date=${startDate}&end_date=${endDate}&freq=${freq}`;

    fetch(url)
      .then(r => {
        if (!r.ok) throw new Error('Failed to fetch analysis data');
        return r.json();
      })
      .then(data => {
        setDashboardData(data);
        setDashLoading(false);
      })
      .catch(err => {
        console.error(err);
        setDashLoading(false);
      });
  }, [selectedSensor, startDate, endDate, aggregation]);

  if (loading) return <div className="page-loading">Loading WS100 data...</div>;
  if (error) return <div className="page-error">Error: {error}</div>;

  const num = (v, d = 1) => (v == null || isNaN(v) ? '—' : Number(v).toFixed(d));

  // Prepare Chart Data with visibility toggles
  const getChartData = () => {
    if (!dashboardData || !dashboardData.stacked_data) return null;

    const periods = [...new Set(dashboardData.stacked_data.map(d => d.period))];
    const events = dashboardData.events || ['Rain', 'Snow', 'Mix', 'Dry', 'Other'];

    const colors = {
      'Rain': '#3b82f6',
      'Snow': '#a855f7',
      'Mix': '#f59e0b',
      'Dry': '#cbd5e1',
      'Other': '#94a3b8'
    };

    const datasets = [];

    events.forEach(event => {
      if (visibleSeries[event]) {
        datasets.push({
          label: event,
          data: periods.map(p => {
            const item = dashboardData.stacked_data.find(d => d.period === p && d.event === event);
            return item ? item[metric] : 0;
          }),
          backgroundColor: colors[event] || '#94a3b8',
          stack: 'stack1',
        });
      }
    });

    if (metric === 'precip' && visibleSeries.Total) {
      datasets.push({
        type: 'line',
        label: 'Total Precip',
        data: periods.map(p => {
          const item = dashboardData.total_line.find(d => d.period === p);
          return item ? item.total_mm : 0;
        }),
        borderColor: '#ef4444',
        borderWidth: 2.5,
        fill: false,
        tension: 0.1,
        pointRadius: 4,
        pointHoverRadius: 6,
        stack: 'stack2'
      });
    }

    return {
      labels: periods,
      datasets: datasets
    };
  };

  const chartData = getChartData();

  const toggleSeries = (series) => {
    setVisibleSeries(prev => ({ ...prev, [series]: !prev[series] }));
  };

  // Metric options with icons
  const metricOptions = [
    { key: 'duration', label: 'Duration (h)', icon: Clock3 },
    { key: 'precip', label: 'Precip (mm)', icon: Droplet },
    { key: 'share', label: 'Share (%)', icon: PieChart },
  ];

  const isDaily = aggregation === 'daily';
  const isMonthly = aggregation === 'monthly';

  return (
    <div className="ws100-modern">
      {/* Enhanced Header */}
      <div className="ws100-modern-header">
        <div>
          <h1>WS100 Sensors</h1>
          <p className="subtitle">Dynamic precipitation dashboard for WS100 sensor network</p>
        </div>
      </div>

      {/* Enhanced Controls Card */}
      <div className="ws100-enhanced-controls" style={{ maxWidth: '1280px', margin: '0 auto 28px' }}>
        <div className="controls-grid-main">

          {/* Sensor Station */}
          <div className="control-field">
            <label>SENSOR STATION</label>
            <select
              value={selectedSensor}
              onChange={(e) => setSelectedSensor(e.target.value)}
            >
              {sensors.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Analysis Period */}
          <div className="control-field">
            <label>ANALYSIS PERIOD</label>
            <div className="date-range-group">
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
              <span>to</span>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>

          {/* Time Aggregation - Modern Pill Toggle */}
          <div className="control-field">
            <label>TIME AGGREGATION</label>
            <div className="ws100-toggle" role="group" aria-label="Time aggregation">
              <button
                type="button"
                aria-pressed={isDaily}
                onClick={() => setAggregation('daily')}
                className={`ws100-toggle-segment ${isDaily ? 'ws100-toggle-segment--active' : ''}`}
              >
                Daily
              </button>
              <button
                type="button"
                aria-pressed={isMonthly}
                onClick={() => setAggregation('monthly')}
                className={`ws100-toggle-segment ${isMonthly ? 'ws100-toggle-segment--active' : ''}`}
              >
                Monthly
              </button>
            </div>
            <p className="control-help-text">Controls how KPIs and charts are grouped (daily vs monthly)</p>
          </div>
        </div>

        {/* Row 2: Visualization Metric Tabs with Icons */}
        <div className="controls-row-metric">
          <div className="metric-section">
            <label className="metric-label">VISUALIZATION METRIC</label>
            <div className="ws100-metric-tabs" role="tablist">
              {metricOptions.map(opt => {
                const isActive = metric === opt.key;
                const TabIcon = opt.icon;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setMetric(opt.key)}
                    className={`ws100-metric-tab ${isActive ? 'ws100-metric-tab--active' : ''}`}
                  >
                    <TabIcon className="ws100-metric-tab__icon" size={16} strokeWidth={2.5} />
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      {!dashLoading && summaryData && (
        <div className="ws100-kpi-grid" style={{ maxWidth: '1280px', margin: '0 auto 28px' }}>
          <div style={{
            background: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)',
            borderRadius: '20px',
            padding: '24px',
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '16px',
            transition: 'transform 0.2s'
          }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Droplet size={24} color="white" strokeWidth={2.5} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '38px', fontWeight: '700', color: 'white', lineHeight: 1.1, marginBottom: '6px', textShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                {num(summaryData.rain_total_mm, 1)} <span style={{ fontSize: '18px', opacity: 0.85 }}>mm</span>
              </div>
              <div style={{ fontSize: '15px', fontWeight: '600', color: 'white', marginBottom: '4px', textShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>Total Rainfall</div>
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.75)' }}>Network Total</div>
            </div>
          </div>

          <div style={{
            background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
            borderRadius: '20px',
            padding: '24px',
            boxShadow: '0 4px 12px rgba(14, 165, 233, 0.25)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '16px',
            transition: 'transform 0.2s'
          }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={24} color="white" strokeWidth={2.5} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '38px', fontWeight: '700', color: 'white', lineHeight: 1.1, marginBottom: '6px', textShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                {summaryData.rain_hours} <span style={{ fontSize: '18px', opacity: 0.85 }}>h</span>
              </div>
              <div style={{ fontSize: '15px', fontWeight: '600', color: 'white', marginBottom: '4px', textShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>Rainy Hours</div>
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.75)' }}>Total Duration</div>
            </div>
          </div>

          <div style={{
            background: 'linear-gradient(135deg, #a855f7 0%, #9333ea 100%)',
            borderRadius: '20px',
            padding: '24px',
            boxShadow: '0 4px 12px rgba(168, 85, 247, 0.25)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '16px',
            transition: 'transform 0.2s'
          }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Activity size={24} color="white" strokeWidth={2.5} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '38px', fontWeight: '700', color: 'white', lineHeight: 1.1, marginBottom: '6px', textShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                {num(summaryData.rain_max_hour_mm, 1)} <span style={{ fontSize: '18px', opacity: 0.85 }}>mm/h</span>
              </div>
              <div style={{ fontSize: '15px', fontWeight: '600', color: 'white', marginBottom: '4px', textShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>Max Intensity</div>
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.75)' }}>Peak Hourly</div>
            </div>
          </div>

          <div style={{
            background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
            borderRadius: '20px',
            padding: '24px',
            boxShadow: '0 4px 12px rgba(34, 197, 94, 0.25)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '16px',
            transition: 'transform 0.2s'
          }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MapPin size={24} color="white" strokeWidth={2.5} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '38px', fontWeight: '700', color: 'white', lineHeight: 1.1, marginBottom: '6px', textShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                {sensors.length}
              </div>
              <div style={{ fontSize: '15px', fontWeight: '600', color: 'white', marginBottom: '4px', textShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>Active Stations</div>
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.75)' }}>Monitoring Points</div>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Chart Card */}
      <div className="ws100-chart-card-enhanced" style={{ maxWidth: '1280px', margin: '0 auto 28px' }}>
        <div className="chart-card-header-enhanced">
          <div className="chart-header-left">
            <h3>
              {aggregation === 'monthly' ? 'Monthly' : 'Daily'} Analysis — Precipitation
            </h3>
            <p className="help-text">
              {aggregation === 'monthly' ? 'Monthly' : 'Daily'} distribution of dry, mix, rain, snow hours and total precipitation
            </p>
          </div>

          <div className="ws100-legend-chips">
            {['Dry', 'Mix', 'Rain', 'Snow'].map(series => (
              <button
                key={series}
                className={`legend-chip chip-${series.toLowerCase()} ${visibleSeries[series] ? 'active' : ''}`}
                onClick={() => toggleSeries(series)}
              >
                <span className="legend-chip-dot"></span>
                {series}
              </button>
            ))}
            {metric === 'precip' && (
              <button
                className={`legend-chip chip-total ${visibleSeries.Total ? 'active' : ''}`}
                onClick={() => toggleSeries('Total')}
              >
                <span className="legend-chip-dot"></span>
                Total
              </button>
            )}
          </div>
        </div>

        <div style={{ height: '480px', position: 'relative' }}>
          {dashLoading ? (
            <div className="skeleton-chart skeleton-loader"></div>
          ) : chartData && chartData.datasets.length > 0 ? (
            <Bar
              data={chartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                  mode: 'index',
                  intersect: false,
                },
                plugins: {
                  legend: { display: false },
                  title: { display: false },
                  tooltip: {
                    backgroundColor: '#ffffff',
                    titleColor: '#0f172a',
                    bodyColor: '#475569',
                    borderColor: '#e2e8f0',
                    borderWidth: 1,
                    padding: 16,
                    titleFont: { size: 14, weight: '600' },
                    bodyFont: { size: 13 },
                    cornerRadius: 10,
                    displayColors: true,
                    boxWidth: 10,
                    boxHeight: 10,
                    boxPadding: 4,
                    callbacks: {
                      title: (items) => items[0].label,
                      label: (context) => {
                        let label = context.dataset.label || '';
                        if (label) label += ': ';
                        if (context.parsed.y !== null) {
                          label += context.parsed.y.toFixed(1) + (metric === 'share' ? '%' : metric === 'duration' ? ' h' : ' mm');
                        }
                        return label;
                      }
                    }
                  }
                },
                scales: {
                  x: {
                    stacked: true,
                    grid: { display: false },
                    ticks: {
                      color: '#64748b',
                      font: { size: 12, weight: '500' },
                      maxRotation: aggregation === 'daily' ? 45 : 0,
                      minRotation: aggregation === 'daily' ? 45 : 0
                    }
                  },
                  y: {
                    stacked: true,
                    beginAtZero: true,
                    grid: { color: '#f1f5f9', drawBorder: false },
                    ticks: { color: '#64748b', font: { size: 12 } },
                    title: {
                      display: true,
                      text: metric === 'share' ? 'Percentage (%)' : metric === 'duration' ? 'Hours (h)' : 'Precipitation (mm)',
                      color: '#475569',
                      font: { size: 13, weight: '600' }
                    }
                  }
                }
              }}
            />
          ) : (
            <div className="empty-state">
              <BarChart size={64} />
              <h4>No data available</h4>
              <p>Select a sensor and date range to view precipitation analysis</p>
            </div>
          )}
        </div>
      </div>

      {/* Network Comparison Matrix Card */}
      <div className="ws100-matrix-card" style={{ maxWidth: '1280px', margin: '0 auto 28px' }}>
        <div className="matrix-card-header">
          <div>
            <h3>Sensor Network Summary — Precipitation Matrix</h3>
            <p className="matrix-subtitle">
              Per-station totals and differences for the selected analysis period. Stations correspond to markers on the map.
            </p>
          </div>
        </div>

        {/* Matrix Tab Control */}
        <div className="matrix-tab-control" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={matrixTab === 'perLocation'}
            onClick={() => setMatrixTab('perLocation')}
            className={`matrix-tab-button ${matrixTab === 'perLocation' ? 'matrix-tab-button--active' : ''}`}
          >
            Per location
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={matrixTab === 'vsMean'}
            onClick={() => setMatrixTab('vsMean')}
            className={`matrix-tab-button ${matrixTab === 'vsMean' ? 'matrix-tab-button--active' : ''}`}
          >
            Vs network mean
          </button>
        </div>

        {/* Matrix Table */}
        <div className="matrix-table-wrapper">
          {matrixTab === 'perLocation' && (
            <table className="matrix-table">
              <thead>
                <tr>
                  <th>Station</th>
                  <th className="text-right">Total rain (mm)</th>
                  <th className="text-right">p99 intensity (mm/h)</th>
                  <th className="text-right">Max event rain (mm)</th>
                  <th className="text-right">Max peak intensity (mm/h)</th>
                  <th className="text-right">Median event duration (h)</th>
                  <th className="text-right">Rain (%)</th>
                  <th className="text-right">Snow (%)</th>
                  <th className="text-right">Mixed (%)</th>
                </tr>
              </thead>
              <tbody>
                {perLocationSummary.map((row, i) => (
                  <tr key={row.station} className={i % 2 === 0 ? 'even' : 'odd'}>
                    <td className="station-name">{row.station}</td>
                    <td className="text-right">{row.totalMm.toFixed(1)}</td>
                    <td className="text-right">{row.p99MmH.toFixed(1)}</td>
                    <td className="text-right">{row.maxEventTotalMm.toFixed(1)}</td>
                    <td className="text-right">{row.maxPeakMmH.toFixed(1)}</td>
                    <td className="text-right">{row.medianEventDurH.toFixed(1)}</td>
                    <td className="text-right">{row.rainPct.toFixed(1)}</td>
                    <td className="text-right">{row.snowPct.toFixed(1)}</td>
                    <td className="text-right">{row.mixedPct.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {matrixTab === 'vsMean' && (
            <>
              <p className="matrix-note">Positive = above network mean, negative = below network mean.</p>
              <table className="matrix-table">
                <thead>
                  <tr>
                    <th>Station</th>
                    <th className="text-right">Total rain (mm)</th>
                    <th className="text-right">p99 intensity (mm/h)</th>
                    <th className="text-right">Max event rain (mm)</th>
                    <th className="text-right">Max peak intensity (mm/h)</th>
                    <th className="text-right">Median event duration (h)</th>
                    <th className="text-right">Rain (%)</th>
                    <th className="text-right">Snow (%)</th>
                    <th className="text-right">Mixed (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {diffVsNetworkMean.map((row, i) => (
                    <tr key={row.station} className={i % 2 === 0 ? 'even' : 'odd'}>
                      <td className="station-name">{row.station}</td>
                      <td className={`text-right ${row.totalMm > 0 ? 'matrix-value-positive' : row.totalMm < 0 ? 'matrix-value-negative' : ''}`}>
                        {row.totalMm > 0 ? '+' : ''}{row.totalMm.toFixed(1)}
                      </td>
                      <td className={`text-right ${row.p99MmH > 0 ? 'matrix-value-positive' : row.p99MmH < 0 ? 'matrix-value-negative' : ''}`}>
                        {row.p99MmH > 0 ? '+' : ''}{row.p99MmH.toFixed(1)}
                      </td>
                      <td className={`text-right ${row.maxEventTotalMm > 0 ? 'matrix-value-positive' : row.maxEventTotalMm < 0 ? 'matrix-value-negative' : ''}`}>
                        {row.maxEventTotalMm > 0 ? '+' : ''}{row.maxEventTotalMm.toFixed(1)}
                      </td>
                      <td className={`text-right ${row.maxPeakMmH > 0 ? 'matrix-value-positive' : row.maxPeakMmH < 0 ? 'matrix-value-negative' : ''}`}>
                        {row.maxPeakMmH > 0 ? '+' : ''}{row.maxPeakMmH.toFixed(1)}
                      </td>
                      <td className={`text-right ${row.medianEventDurH > 0 ? 'matrix-value-positive' : row.medianEventDurH < 0 ? 'matrix-value-negative' : ''}`}>
                        {row.medianEventDurH > 0 ? '+' : ''}{row.medianEventDurH.toFixed(1)}
                      </td>
                      <td className={`text-right ${row.rainPct > 0 ? 'matrix-value-positive' : row.rainPct < 0 ? 'matrix-value-negative' : ''}`}>
                        {row.rainPct > 0 ? '+' : ''}{row.rainPct.toFixed(1)}
                      </td>
                      <td className={`text-right ${row.snowPct > 0 ? 'matrix-value-positive' : row.snowPct < 0 ? 'matrix-value-negative' : ''}`}>
                        {row.snowPct > 0 ? '+' : ''}{row.snowPct.toFixed(1)}
                      </td>
                      <td className={`text-right ${row.mixedPct > 0 ? 'matrix-value-positive' : row.mixedPct < 0 ? 'matrix-value-negative' : ''}`}>
                        {row.mixedPct > 0 ? '+' : ''}{row.mixedPct.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>

      {/* Collapsible Table Card */}
      <div className="ws100-table-collapsible" style={{ maxWidth: '1280px', margin: '0 auto' }}>
        <div className="table-card-header">
          <div className="table-header-left">
            <h3>Detailed Breakdown</h3>
            <p className="subtitle">Full breakdown of dry, mix, rain, and snow hours and millimetres for each period</p>
          </div>
          <button
            className={`table-toggle-button ${tableExpanded ? 'expanded' : ''}`}
            onClick={() => setTableExpanded(!tableExpanded)}
          >
            {tableExpanded ? 'Hide detailed table' : 'Show detailed table'}
            <ChevronDown />
          </button>
        </div>

        <div className={`table-content ${tableExpanded ? 'expanded' : ''}`}>
          <div className="table-wrapper-enhanced">
            {dashboardData && dashboardData.table_data && dashboardData.table_data.length > 0 ? (
              <table className="enhanced-data-table">
                <thead>
                  <tr>
                    <th>Period</th>
                    {dashboardData.events.map(e => (
                      <React.Fragment key={e}>
                        <th className="text-right">{e} (h)</th>
                        <th className="text-right">{e} (mm)</th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dashboardData.table_data.map((row, i) => (
                    <tr key={i}>
                      <td className="font-semibold">{row.period}</td>
                      {dashboardData.events.map(e => (
                        <React.Fragment key={e}>
                          <td className="text-right">{num(row[`${e}_dur`])}</td>
                          <td className="text-right">{num(row[`${e}_mm`])}</td>
                        </React.Fragment>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty-state">
                <p>No table data available for the selected period</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
