import React, { useState, useEffect } from 'react';
import { Line, Bar } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    Filler,
} from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';
import zoomPlugin from 'chartjs-plugin-zoom';
import {
    Calendar,
    CalendarCheck,
    Activity,
    Hourglass,
    Clock,
    Flag,
    Droplets,
    Timer,
    Sliders,
    CloudSun,
    Table as TableIcon,
    PlayCircle,
    StopCircle,
    CloudRain,
    CloudSnow,
    Cloud,
    RotateCcw,
    Thermometer,
    Wind,
    Gauge,
    Compass,
} from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import KpiCard from '../components/ui/KpiCard';
import ChartCard from '../components/ui/ChartCard';
import { DistanceMatrixCard } from '../components/DistanceMatrixCard';
import SeasonDryingStrip from '../components/SeasonDryingStrip';
import './Pages.css';

// Register Chart.js components and plugins
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    Filler,
    annotationPlugin,
    zoomPlugin
);

export default function AnalyzePage() {
    // Form state with defaults
    const [date, setDate] = useState('2024-09-18'); // Default date with known events
    const [lhtSensor, setLhtSensor] = useState('Kaunisharjuntie');
    const [ws100Sensor, setWs100Sensor] = useState('Kotaniementie');
    const [preH, setPreH] = useState(6);
    const [postH, setPostH] = useState(12); // Default 12 hours as specified

    // Sensor lists
    const [lhtSensors, setLhtSensors] = useState([]);
    const [ws100Sensors, setWs100Sensors] = useState([]);

    // Data state
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [data, setData] = useState(null);

    // Dataset visibility state for chart legend
    const [datasetVisibility, setDatasetVisibility] = useState({
        0: true, // RH
        1: true, // ΔT
        2: true, // VPD
        3: true, // Wind
        4: false, // Gust (hidden by default)
        5: false, // Dir (hidden by default)
        6: false, // Pressure (hidden by default)
    });

    // Toggle dataset visibility
    const toggleDataset = (datasetIndex) => {
        setDatasetVisibility(prev => ({
            ...prev,
            [datasetIndex]: !prev[datasetIndex],
        }));

        // Update chart if it exists
        if (chartRef.current) {
            const chart = chartRef.current;
            chart.setDatasetVisibility(datasetIndex, !chart.isDatasetVisible(datasetIndex));
            chart.update();
        }
    };

    // Fetch sensor lists on mount
    useEffect(() => {
        async function fetchSensors() {
            try {
                const [lhtRes, ws100Res] = await Promise.all([
                    fetch('http://localhost:8000/api/lht/list'),
                    fetch('http://localhost:8000/api/ws100/list'),
                ]);

                if (lhtRes.ok && ws100Res.ok) {
                    const lhtData = await lhtRes.json();
                    const ws100Data = await ws100Res.json();
                    setLhtSensors(lhtData.sensors || []);
                    setWs100Sensors(ws100Data.sensors || []);
                }
            } catch (err) {
                console.error('Failed to fetch sensor lists:', err);
            }
        }

        fetchSensors();
    }, []);

    // Fetch event data
    async function fetchEventData() {
        setLoading(true);
        setError(null);
        setData(null);

        try {
            const url = `http://localhost:8000/api/analyze/event-aggregates?date=${date}&lht_sensor=${encodeURIComponent(lhtSensor)}&ws100_sensor=${encodeURIComponent(ws100Sensor)}&pre_h=${preH}&post_h=${postH}`;
            const res = await fetch(url);

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.detail || `HTTP ${res.status}`);
            }

            const result = await res.json();
            setData(result);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    // Helper to format numbers
    const num = (v, decimals = 1) => (v == null || isNaN(v) ? '—' : Number(v).toFixed(decimals));

    // Helper to format time from ISO string
    const formatTime = (isoString) => {
        if (!isoString) return '—';
        try {
            const date = new Date(isoString);
            return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
        } catch {
            return '—';
        }
    };

    // Helper to normalize event type
    const normalizeEventType = (raw) => {
        if (!raw) return { kind: 'unknown', label: 'Event' };

        const v = String(raw).toLowerCase();
        if (v.includes('rain')) return { kind: 'rain', label: 'Rain' };
        if (v.includes('snow')) return { kind: 'snow', label: 'Snow' };
        if (v.includes('mix') || v.includes('mixed')) {
            return { kind: 'mixed', label: 'Rain / Snow mix' };
        }
        return { kind: 'other', label: raw };
    };

    // Get first event for summary card
    const firstEvent = data?.events?.[0] || null;

    // Chart ref for reset zoom functionality
    const chartRef = React.useRef(null);

    // Reset zoom handler
    const resetZoom = () => {
        if (chartRef.current) {
            chartRef.current.resetZoom();
        }
    };

    // Prepare Environmental Conditions chart data with all 7 datasets
    const environmentChartData = () => {
        if (!data?.environment) return null;

        const envData = data.environment;
        // We don't need labels array for linear scale, but keeping it doesn't hurt
        const labels = envData.map(d => d.rel_hour);

        // Store raw values for tooltips (attached to each dataset)
        return {
            labels,
            datasets: [
                {
                    label: 'RH',
                    data: envData.map(d => ({ x: d.rel_hour, y: d.rh_mean })),
                    rawData: envData.map(d => d.rh_mean),
                    unit: '%',
                    borderColor: '#2563eb',
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    borderWidth: 2,
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    tension: 0.3,
                    yAxisID: 'y',
                },
                {
                    label: 'ΔT',
                    data: envData.map(d => ({ x: d.rel_hour, y: d.dp_spread_mean })),
                    rawData: envData.map(d => d.dp_spread_mean),
                    unit: '°C',
                    borderColor: '#fb923c',
                    backgroundColor: 'rgba(251, 146, 60, 0.1)',
                    borderWidth: 2,
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    tension: 0.3,
                    yAxisID: 'y',
                },
                {
                    label: 'VPD',
                    data: envData.map(d => ({ x: d.rel_hour, y: d.vpd_mean })),
                    rawData: envData.map(d => d.vpd_mean),
                    unit: 'kPa',
                    borderColor: '#a855f7',
                    backgroundColor: 'rgba(168, 85, 247, 0.1)',
                    borderWidth: 2,
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    tension: 0.3,
                    yAxisID: 'y',
                },
                {
                    label: 'Wind',
                    data: envData.map(d => ({ x: d.rel_hour, y: d.wind_mean })),
                    rawData: envData.map(d => d.wind_mean),
                    unit: 'km/h',
                    borderColor: '#0ea5e9',
                    backgroundColor: 'rgba(14, 165, 233, 0.1)',
                    borderWidth: 2,
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    tension: 0.3,
                    yAxisID: 'y',
                },
                {
                    label: 'Gust',
                    data: envData.map(d => ({ x: d.rel_hour, y: d.wind_gusts_kmh_mean || null })),
                    rawData: envData.map(d => d.wind_gusts_kmh_mean),
                    unit: 'km/h',
                    borderColor: '#14b8a6',
                    backgroundColor: 'rgba(20, 184, 166, 0.1)',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    tension: 0.3,
                    yAxisID: 'y',
                },
                {
                    label: 'Dir',
                    data: envData.map(d => ({ x: d.rel_hour, y: d.wind_direction_deg_mean != null ? d.wind_direction_deg_mean / 3.6 : null })), // Scale to fit
                    rawData: envData.map(d => d.wind_direction_deg_mean),
                    unit: '°',
                    borderColor: '#64748b',
                    backgroundColor: 'rgba(100, 116, 139, 0.1)',
                    borderWidth: 2,
                    borderDash: [2, 2],
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    tension: 0.3,
                    yAxisID: 'y',
                },
                {
                    label: 'Pressure',
                    data: envData.map(d => ({ x: d.rel_hour, y: d.surface_pressure_hpa_mean != null ? (d.surface_pressure_hpa_mean - 950) : null })), // Offset for scaling
                    rawData: envData.map(d => d.surface_pressure_hpa_mean),
                    unit: 'hPa',
                    borderColor: '#111827',
                    backgroundColor: 'rgba(17, 24, 39, 0.1)',
                    borderWidth: 2,
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    tension: 0.3,
                    yAxisID: 'y',
                },
            ],
        };
    };

    const environmentChartOptions = (() => {
        const eventType = normalizeEventType(firstEvent?.ptype_main);
        const eventLabel = eventType.label; // e.g. "Snow"

        return {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    display: false, // We'll use custom legend below the chart
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    padding: 12,
                    titleFont: { size: 13, weight: '600' },
                    bodyFont: { size: 12 },
                    displayColors: true,
                    callbacks: {
                        title: function (items) {
                            const h = items[0]?.parsed?.x;
                            if (!Number.isFinite(h)) return '';
                            if (h === 0) return `${eventLabel} start (0 h)`;
                            const abs = Math.abs(h).toFixed(0);
                            const dir = h < 0 ? 'before' : 'after';
                            return `${abs} h ${dir} event start`;
                        },
                        label: function (context) {
                            const dataset = context.dataset;
                            const rawValue = dataset.rawData?.[context.dataIndex];
                            if (rawValue == null) return null;
                            return `${dataset.label}: ${rawValue.toFixed(1)} ${dataset.unit}`;
                        }
                    },
                },
                annotation: {
                    annotations: {
                        // Pre-event grey background
                        preEventBg: {
                            type: 'box',
                            xMin: -preH,
                            xMax: 0,
                            backgroundColor: 'rgba(249, 250, 251, 0.5)',
                            borderWidth: 0,
                            drawTime: 'beforeDatasetsDraw',
                        },
                        // Post-event blue background
                        postEventBg: {
                            type: 'box',
                            xMin: 0,
                            xMax: postH,
                            backgroundColor: 'rgba(239, 246, 255, 0.4)',
                            borderWidth: 0,
                            drawTime: 'beforeDatasetsDraw',
                        },
                        // Event start line
                        eventStart: {
                            type: 'line',
                            xMin: 0,
                            xMax: 0,
                            borderColor: '#f97316',
                            borderWidth: 2,
                            borderDash: [5, 5],
                            label: {
                                display: true,
                                content: `${eventLabel} Start`,
                                position: 'start',
                                backgroundColor: '#f97316',
                                color: '#fff',
                                font: { size: 11, weight: 'bold' },
                                padding: { top: 4, bottom: 4, left: 6, right: 6 },
                                borderRadius: 4,
                            },
                        },
                    },
                },
                zoom: {
                    pan: {
                        enabled: true,
                        mode: 'x',
                        modifierKey: 'ctrl',
                    },
                    zoom: {
                        wheel: {
                            enabled: true,
                            modifierKey: 'ctrl',
                        },
                        pinch: {
                            enabled: true,
                        },
                        mode: 'x',
                    },
                    limits: {
                        x: { min: -preH, max: postH },
                    },
                },
            },
            scales: {
                x: {
                    type: 'linear',
                    title: {
                        display: true,
                        text: 'Time relative to event start (h)',
                        font: { size: 12, weight: '600' },
                        color: '#475569',
                    },
                    grid: {
                        color: '#e5e7eb',
                        drawBorder: false,
                    },
                    ticks: {
                        font: { size: 11 },
                        color: '#64748b',
                        maxTicksLimit: postH >= 60 ? 10 : 15,
                        callback: function (value) {
                            if (!Number.isFinite(value)) return '';
                            if (value === 0) return '0 h';
                            const abs = Math.abs(value);
                            const sign = value < 0 ? '−' : '+';
                            return `${sign}${abs} h`;
                        },
                    },
                },
                y: {
                    title: {
                        display: true,
                        text: 'Scaled Value',
                        font: { size: 12, weight: '600' },
                        color: '#475569',
                    },
                    grid: {
                        color: '#e5e7eb',
                        drawBorder: false,
                    },
                    ticks: {
                        font: { size: 11 },
                        color: '#64748b',
                    },
                },
            },
        };
    })();

    // Prepare Wet/Dry Fractions chart data
    const fractionsChartData = () => {
        if (!data?.fractions?.records) return null;

        const fracData = data.fractions.records;
        const labels = fracData.map(d => d.rel_hour);

        return {
            labels,
            datasets: [
                {
                    label: 'Wet (%)',
                    data: fracData.map(d => (d.wet_frac || 0) * 100),
                    backgroundColor: '#3b82f6',
                    borderColor: '#2563eb',
                    borderWidth: 1,
                },
                {
                    label: 'Dry (%)',
                    data: fracData.map(d => (d.dry_frac || 0) * 100),
                    backgroundColor: '#86efac',
                    borderColor: '#4ade80',
                    borderWidth: 1,
                },
            ],
        };
    };

    const fractionsChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            mode: 'index',
            intersect: false,
        },
        plugins: {
            legend: {
                display: true,
                position: 'top',
                labels: {
                    usePointStyle: true,
                    padding: 12,
                    font: { size: 12 },
                },
            },
            tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                padding: 12,
                callbacks: {
                    label: (context) => `${context.dataset.label}: ${num(context.parsed.y, 1)}%`,
                },
            },
        },
        scales: {
            x: {
                title: {
                    display: true,
                    text: 'Hours from Event Start',
                    font: { size: 12, weight: '600' },
                },
                grid: {
                    color: 'rgba(148, 163, 184, 0.15)',
                },
                stacked: false,
            },
            y: {
                title: {
                    display: true,
                    text: 'Fraction (%)',
                    font: { size: 12, weight: '600' },
                },
                grid: {
                    color: 'rgba(148, 163, 184, 0.15)',
                },
                min: 0,
                max: 100,
                ticks: {
                    callback: (value) => `${value}%`,
                },
            },
        },
    };

    // Render RH Heatmap
    const renderHeatmap = () => {
        if (!data?.heatmap) return <p className="text-slate-600">No heatmap data available.</p>;

        const { dates, hours, rh_matrix } = data.heatmap;
        if (!rh_matrix || rh_matrix.length === 0) {
            return <p className="text-slate-600">No heatmap data available.</p>;
        }

        // Create color scale for RH
        const getColor = (rh) => {
            if (rh == null) return '#f3f4f6';
            // Blue scale: lighter for low RH, darker for high RH
            const intensity = rh / 100;
            const r = Math.round(219 - intensity * 160);
            const g = Math.round(234 - intensity * 134);
            const b = Math.round(254 - intensity * 54);
            return `rgb(${r}, ${g}, ${b})`;
        };

        return (
            <div style={{ overflowX: 'auto' }}>
                <div style={{ display: 'inline-block', minWidth: '100%' }}>
                    {/* Header row with hours */}
                    <div style={{ display: 'flex', marginBottom: '4px' }}>
                        <div style={{ width: '100px', flexShrink: 0 }} /> {/* Date column spacer */}
                        {hours.map((h) => (
                            <div
                                key={h}
                                style={{
                                    width: '32px',
                                    textAlign: 'center',
                                    fontSize: '11px',
                                    color: '#6b7280',
                                    fontWeight: '600',
                                }}
                            >
                                {h}
                            </div>
                        ))}
                    </div>

                    {/* Heatmap rows */}
                    {dates.map((date, rowIdx) => (
                        <div key={date} style={{ display: 'flex', marginBottom: '2px' }}>
                            <div
                                style={{
                                    width: '100px',
                                    flexShrink: 0,
                                    fontSize: '12px',
                                    color: '#374151',
                                    fontWeight: '500',
                                    paddingRight: '8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                }}
                            >
                                {date}
                            </div>
                            {rh_matrix[rowIdx]?.map((rh, colIdx) => (
                                <div
                                    key={colIdx}
                                    style={{
                                        width: '32px',
                                        height: '28px',
                                        backgroundColor: getColor(rh),
                                        border: '1px solid #e5e7eb',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '10px',
                                        color: rh > 50 ? '#fff' : '#374151',
                                        fontWeight: '500',
                                    }}
                                    title={`${date} ${hours[colIdx]}:00 - RH: ${rh != null ? num(rh, 0) : 'N/A'}%`}
                                >
                                    {rh != null ? Math.round(rh) : '—'}
                                </div>
                            ))}
                        </div>
                    ))}

                    {/* Legend */}
                    <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: '600' }}>0% RH</span>
                        <div style={{ display: 'flex', height: '16px', flex: 1, maxWidth: '200px' }}>
                            {[0, 20, 40, 60, 80, 100].map((val) => (
                                <div
                                    key={val}
                                    style={{
                                        flex: 1,
                                        backgroundColor: getColor(val),
                                        border: '1px solid #e5e7eb',
                                    }}
                                />
                            ))}
                        </div>
                        <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: '600' }}>100% RH</span>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="page" style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px' }}>
            {/* Page Header */}
            <PageHeader
                title="Event-based Analysis"
                description="Deep dive into precipitation events, drying cycles and environmental conditions from the moment rain starts."
                rightContent={
                    <div
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 12px',
                            background: 'linear-gradient(135deg, #3b82f6, #60a5fa)',
                            borderRadius: '9999px',
                            color: '#fff',
                            fontSize: '12px',
                            fontWeight: '600',
                            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                        }}
                    >
                        <Activity size={14} />
                        <span>Live Analysis Mode</span>
                    </div>
                }
            />

            <div className="page-section">
                <DistanceMatrixCard />
            </div>

            {/* Median drying by season strip */}
            <div className="page-section">
                <SeasonDryingStrip />
            </div>

            {/* Analysis Parameters Card */}
            <div
                style={{
                    maxWidth: '960px',
                    margin: '24px auto',
                    background: '#F9FAFB',
                    borderRadius: '16px',
                    padding: '24px',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px' }}>
                    <div
                        style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #3b82f6, #60a5fa)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#fff',
                        }}
                    >
                        <Sliders size={16} />
                    </div>
                    <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#0f172a' }}>
                        Analysis Parameters
                    </h2>
                </div>

                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                        gap: '16px',
                    }}
                >
                    <div className="filter-group">
                        <label htmlFor="analyze-date">Date</label>
                        <input
                            id="analyze-date"
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                        />
                    </div>
                    <div className="filter-group">
                        <label htmlFor="analyze-lht">LHT Sensor</label>
                        <select
                            id="analyze-lht"
                            value={lhtSensor}
                            onChange={(e) => setLhtSensor(e.target.value)}
                            disabled={lhtSensors.length === 0}
                        >
                            {lhtSensors.map((s) => (
                                <option key={s} value={s}>
                                    {s}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="filter-group">
                        <label htmlFor="analyze-ws100">WS100 Sensor</label>
                        <select
                            id="analyze-ws100"
                            value={ws100Sensor}
                            onChange={(e) => setWs100Sensor(e.target.value)}
                            disabled={ws100Sensors.length === 0}
                        >
                            {ws100Sensors.map((s) => (
                                <option key={s} value={s}>
                                    {s}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="filter-group">
                        <label htmlFor="analyze-pre">Pre (h)</label>
                        <input
                            id="analyze-pre"
                            type="number"
                            value={preH}
                            onChange={(e) => setPreH(Number(e.target.value))}
                            min="0"
                            max="48"
                        />
                    </div>
                    <div className="filter-group">
                        <label htmlFor="analyze-post">Post (h)</label>
                        <input
                            id="analyze-post"
                            type="number"
                            value={postH}
                            onChange={(e) => setPostH(Number(e.target.value))}
                            min="0"
                            max="120"
                        />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                        <button
                            onClick={fetchEventData}
                            disabled={loading}
                            style={{
                                width: '100%',
                                padding: '10px 20px',
                                background: loading ? '#94a3b8' : 'linear-gradient(135deg, #2563eb, #3b82f6)',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '14px',
                                fontWeight: '600',
                                cursor: loading ? 'not-allowed' : 'pointer',
                                boxShadow: loading ? 'none' : '0 4px 12px rgba(37, 99, 235, 0.3)',
                                transition: 'all 150ms ease',
                            }}
                        >
                            {loading ? 'Loading...' : 'Run Analysis'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Error State */}
            {error && !loading && (
                <div className="page-error" style={{ margin: '24px 0' }}>
                    Error: {error}
                </div>
            )}

            {/* Loading State */}
            {loading && (
                <div style={{
                    maxWidth: '960px',
                    margin: '24px auto',
                    background: 'linear-gradient(135deg, #eff6ff, #dbeafe)',
                    borderRadius: '16px',
                    padding: '48px 24px',
                    boxShadow: '0 4px 16px rgba(59, 130, 246, 0.1)',
                    textAlign: 'center'
                }}>
                    <div style={{
                        width: '48px',
                        height: '48px',
                        margin: '0 auto 16px',
                        borderRadius: '50%',
                        border: '4px solid #3b82f6',
                        borderTopColor: 'transparent',
                        animation: 'spin 1s linear infinite'
                    }} />
                    <h3 style={{
                        margin: '0 0 8px 0',
                        fontSize: '18px',
                        fontWeight: '600',
                        color: '#1e40af'
                    }}>
                        Analyzing event data...
                    </h3>
                    <p style={{
                        margin: 0,
                        fontSize: '14px',
                        color: '#3b82f6'
                    }}>
                        This may take a few moments
                    </p>
                    <style>
                        {`
                            @keyframes spin {
                                to { transform: rotate(360deg); }
                            }
                        `}
                    </style>
                </div>
            )}

            {/* Data Display */}
            {data && !loading && !error && (
                <>
                    {/* KPI Summary Strip */}
                    <section className="overview-kpis" style={{ marginBottom: '32px' }}>
                        <KpiCard
                            label="Events on this date"
                            value={data.n_events_date || 0}
                            icon={<CalendarCheck size={20} strokeWidth={2} />}
                            variant="humidity"
                        />
                        <KpiCard
                            label="Total events (selected period)"
                            value={data.n_events_all || 0}
                            icon={<Activity size={20} strokeWidth={2} />}
                            variant="sensors"
                        />
                        <KpiCard
                            label="Median drying time"
                            value={
                                data.fractions?.median_drying_h != null
                                    ? `${num(data.fractions.median_drying_h, 1)} h`
                                    : '—'
                            }
                            icon={<Hourglass size={20} strokeWidth={2} />}
                            variant="rain"
                        />

                        {/* Event Summary Card - Redesigned with Pills */}
                        <div style={{
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderRadius: '16px',
                            padding: '20px',
                            boxShadow: '0 10px 30px rgba(15, 23, 42, 0.04)',
                        }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                marginBottom: '16px'
                            }}>
                                <CloudSun size={20} strokeWidth={2} style={{ color: '#2563eb' }} />
                                <h3 style={{
                                    margin: 0,
                                    fontSize: '16px',
                                    fontWeight: '600',
                                    color: '#0f172a'
                                }}>
                                    Event Summary
                                </h3>
                            </div>

                            {firstEvent ? (
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                                    gap: '12px',
                                }}>
                                    {/* Start Time Pill */}
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        padding: '12px',
                                        background: '#f8fafc',
                                        borderRadius: '12px',
                                    }}>
                                        <div style={{
                                            width: '36px',
                                            height: '36px',
                                            borderRadius: '50%',
                                            background: '#eff6ff',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0,
                                        }}>
                                            <PlayCircle size={20} strokeWidth={1.75} style={{ color: '#2563eb' }} />
                                        </div>
                                        <div>
                                            <div style={{
                                                fontSize: '11px',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.5px',
                                                color: '#64748b',
                                                marginBottom: '2px',
                                            }}>
                                                Start Time
                                            </div>
                                            <div style={{
                                                fontSize: '14px',
                                                fontWeight: '600',
                                                color: '#0f172a',
                                            }}>
                                                {formatTime(firstEvent.start_ts)}
                                            </div>
                                        </div>
                                    </div>

                                    {/* End Time Pill */}
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        padding: '12px',
                                        background: '#f8fafc',
                                        borderRadius: '12px',
                                    }}>
                                        <div style={{
                                            width: '36px',
                                            height: '36px',
                                            borderRadius: '50%',
                                            background: '#eff6ff',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0,
                                        }}>
                                            <StopCircle size={20} strokeWidth={1.75} style={{ color: '#2563eb' }} />
                                        </div>
                                        <div>
                                            <div style={{
                                                fontSize: '11px',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.5px',
                                                color: '#64748b',
                                                marginBottom: '2px',
                                            }}>
                                                End Time
                                            </div>
                                            <div style={{
                                                fontSize: '14px',
                                                fontWeight: '600',
                                                color: '#0f172a',
                                            }}>
                                                {formatTime(firstEvent.end_ts)}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Event Type Pill */}
                                    {(() => {
                                        const eventType = normalizeEventType(firstEvent.ptype_main);
                                        const EventTypeIcon =
                                            eventType.kind === 'rain' ? CloudRain :
                                                eventType.kind === 'snow' ? CloudSnow :
                                                    eventType.kind === 'mixed' ? Cloud :
                                                        Cloud;
                                        const iconColor =
                                            eventType.kind === 'rain' ? '#2563eb' :
                                                eventType.kind === 'snow' ? '#0ea5e9' :
                                                    eventType.kind === 'mixed' ? '#a855f7' :
                                                        '#64748b';
                                        const bgColor =
                                            eventType.kind === 'rain' ? '#eff6ff' :
                                                eventType.kind === 'snow' ? '#f0f9ff' :
                                                    eventType.kind === 'mixed' ? '#faf5ff' :
                                                        '#f8fafc';

                                        return (
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '12px',
                                                padding: '12px',
                                                background: '#f8fafc',
                                                borderRadius: '12px',
                                            }}>
                                                <div style={{
                                                    width: '36px',
                                                    height: '36px',
                                                    borderRadius: '50%',
                                                    background: bgColor,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    flexShrink: 0,
                                                }}>
                                                    <EventTypeIcon size={20} strokeWidth={1.75} style={{ color: iconColor }} />
                                                </div>
                                                <div>
                                                    <div style={{
                                                        fontSize: '11px',
                                                        textTransform: 'uppercase',
                                                        letterSpacing: '0.5px',
                                                        color: '#64748b',
                                                        marginBottom: '2px',
                                                    }}>
                                                        Event Type
                                                    </div>
                                                    <div style={{
                                                        fontSize: '14px',
                                                        fontWeight: '600',
                                                        color: '#0f172a',
                                                    }}>
                                                        {eventType.label}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    {/* Rain Total Pill */}
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        padding: '12px',
                                        background: '#f8fafc',
                                        borderRadius: '12px',
                                    }}>
                                        <div style={{
                                            width: '36px',
                                            height: '36px',
                                            borderRadius: '50%',
                                            background: '#eff6ff',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0,
                                        }}>
                                            <CloudRain size={20} strokeWidth={1.75} style={{ color: '#2563eb' }} />
                                        </div>
                                        <div>
                                            <div style={{
                                                fontSize: '11px',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.5px',
                                                color: '#64748b',
                                                marginBottom: '2px',
                                            }}>
                                                Rain Total
                                            </div>
                                            <div style={{
                                                fontSize: '14px',
                                                fontWeight: '600',
                                                color: '#0f172a',
                                            }}>
                                                {num(firstEvent.mm_total, 1)} mm
                                            </div>
                                        </div>
                                    </div>

                                    {/* Duration Pill */}
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        padding: '12px',
                                        background: '#f8fafc',
                                        borderRadius: '12px',
                                    }}>
                                        <div style={{
                                            width: '36px',
                                            height: '36px',
                                            borderRadius: '50%',
                                            background: '#eff6ff',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0,
                                        }}>
                                            <Timer size={20} strokeWidth={1.75} style={{ color: '#2563eb' }} />
                                        </div>
                                        <div>
                                            <div style={{
                                                fontSize: '11px',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.5px',
                                                color: '#64748b',
                                                marginBottom: '2px',
                                            }}>
                                                Duration
                                            </div>
                                            <div style={{
                                                fontSize: '14px',
                                                fontWeight: '600',
                                                color: '#0f172a',
                                            }}>
                                                {num(firstEvent.duration_h, 1)} h
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div style={{
                                    color: '#64748b',
                                    fontSize: '14px',
                                    textAlign: 'center',
                                    padding: '24px 0',
                                }}>
                                    No events detected on this date
                                </div>
                            )}
                        </div>
                    </section>



                    {/* Environmental Conditions Section */}
                    <div style={{ marginBottom: '32px' }}>
                        {/* Environment Means Chart with Modern Styling */}
                        {environmentChartData() && (
                            <div style={{
                                maxWidth: '1100px',
                                margin: '0 auto',
                                background: '#ffffff',
                                borderRadius: '20px',
                                padding: '24px',
                                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
                            }}>
                                {/* Header with Title and Reset Button */}
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'flex-start',
                                    marginBottom: '16px',
                                }}>
                                    <div>
                                        <h3 style={{
                                            fontSize: '18px',
                                            fontWeight: '600',
                                            color: '#0f172a',
                                            margin: '0 0 6px 0',
                                        }}>
                                            Environment Means – {normalizeEventType(firstEvent?.ptype_main).label} event
                                        </h3>
                                        <p style={{
                                            fontSize: '13px',
                                            color: '#64748b',
                                            margin: 0,
                                            maxWidth: '700px',
                                        }}>
                                            Hourly averaged meteorological parameters around the {normalizeEventType(firstEvent?.ptype_main).label.toLowerCase()} event (hour 0 = event start).
                                            Use scroll to zoom and drag to pan along time.
                                        </p>
                                    </div>
                                    <button
                                        onClick={resetZoom}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            padding: '8px 16px',
                                            background: '#f8fafc',
                                            border: '1px solid #e2e8f0',
                                            borderRadius: '8px',
                                            fontSize: '13px',
                                            fontWeight: '500',
                                            color: '#475569',
                                            cursor: 'pointer',
                                            transition: 'all 150ms ease',
                                        }}
                                        onMouseEnter={(e) => {
                                            e.target.style.background = '#f1f5f9';
                                            e.target.style.borderColor = '#cbd5e1';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.target.style.background = '#f8fafc';
                                            e.target.style.borderColor = '#e2e8f0';
                                        }}
                                    >
                                        <RotateCcw size={14} />
                                        Reset View
                                    </button>
                                </div>

                                {/* Custom Legend with Centered Group Labels */}
                                <div style={{ marginBottom: '20px' }}>
                                    {/* Moisture Group */}
                                    <div style={{ marginBottom: '16px' }}>
                                        <div style={{
                                            fontSize: '11px',
                                            fontWeight: '600',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.8px',
                                            color: '#9ca3af',
                                            marginBottom: '8px',
                                            textAlign: 'center',
                                        }}>
                                            MOISTURE
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
                                            {/* RH */}
                                            <button
                                                onClick={() => toggleDataset(0)}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    padding: '6px 12px',
                                                    background: datasetVisibility[0] ? '#2563eb' : '#f1f5f9',
                                                    color: datasetVisibility[0] ? '#ffffff' : '#64748b',
                                                    border: datasetVisibility[0] ? 'none' : '1px solid #e2e8f0',
                                                    borderRadius: '6px',
                                                    fontSize: '12px',
                                                    fontWeight: '500',
                                                    cursor: 'pointer',
                                                    transition: 'all 150ms ease',
                                                }}
                                            >
                                                <Droplets size={14} />
                                                RH
                                            </button>
                                            {/* ΔT */}
                                            <button
                                                onClick={() => toggleDataset(1)}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    padding: '6px 12px',
                                                    background: datasetVisibility[1] ? '#fb923c' : '#f1f5f9',
                                                    color: datasetVisibility[1] ? '#ffffff' : '#64748b',
                                                    border: datasetVisibility[1] ? 'none' : '1px solid #e2e8f0',
                                                    borderRadius: '6px',
                                                    fontSize: '12px',
                                                    fontWeight: '500',
                                                    cursor: 'pointer',
                                                    transition: 'all 150ms ease',
                                                }}
                                            >
                                                <Thermometer size={14} />
                                                ΔT
                                            </button>
                                            {/* VPD */}
                                            <button
                                                onClick={() => toggleDataset(2)}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    padding: '6px 12px',
                                                    background: datasetVisibility[2] ? '#a855f7' : '#f1f5f9',
                                                    color: datasetVisibility[2] ? '#ffffff' : '#64748b',
                                                    border: datasetVisibility[2] ? 'none' : '1px solid #e2e8f0',
                                                    borderRadius: '6px',
                                                    fontSize: '12px',
                                                    fontWeight: '500',
                                                    cursor: 'pointer',
                                                    transition: 'all 150ms ease',
                                                }}
                                            >
                                                <Droplets size={14} />
                                                VPD
                                            </button>
                                        </div>
                                    </div>

                                    {/* Wind Group */}
                                    <div style={{ marginBottom: '16px' }}>
                                        <div style={{
                                            fontSize: '11px',
                                            fontWeight: '600',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.8px',
                                            color: '#9ca3af',
                                            marginBottom: '8px',
                                            textAlign: 'center',
                                        }}>
                                            WIND
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
                                            {/* Wind */}
                                            <button
                                                onClick={() => toggleDataset(3)}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    padding: '6px 12px',
                                                    background: datasetVisibility[3] ? '#0ea5e9' : '#f1f5f9',
                                                    color: datasetVisibility[3] ? '#ffffff' : '#64748b',
                                                    border: datasetVisibility[3] ? 'none' : '1px solid #e2e8f0',
                                                    borderRadius: '6px',
                                                    fontSize: '12px',
                                                    fontWeight: '500',
                                                    cursor: 'pointer',
                                                    transition: 'all 150ms ease',
                                                }}
                                            >
                                                <Wind size={14} />
                                                Wind
                                            </button>
                                            {/* Gust */}
                                            <button
                                                onClick={() => toggleDataset(4)}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    padding: '6px 12px',
                                                    background: datasetVisibility[4] ? '#14b8a6' : '#f1f5f9',
                                                    color: datasetVisibility[4] ? '#ffffff' : '#64748b',
                                                    border: datasetVisibility[4] ? 'none' : '1px solid #e2e8f0',
                                                    borderRadius: '6px',
                                                    fontSize: '12px',
                                                    fontWeight: '500',
                                                    cursor: 'pointer',
                                                    transition: 'all 150ms ease',
                                                }}
                                            >
                                                <Wind size={14} />
                                                Gust
                                            </button>
                                            {/* Dir */}
                                            <button
                                                onClick={() => toggleDataset(5)}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    padding: '6px 12px',
                                                    background: datasetVisibility[5] ? '#64748b' : '#f1f5f9',
                                                    color: datasetVisibility[5] ? '#ffffff' : '#64748b',
                                                    border: datasetVisibility[5] ? 'none' : '1px solid #e2e8f0',
                                                    borderRadius: '6px',
                                                    fontSize: '12px',
                                                    fontWeight: '500',
                                                    cursor: 'pointer',
                                                    transition: 'all 150ms ease',
                                                }}
                                            >
                                                <Compass size={14} />
                                                Dir
                                            </button>
                                        </div>
                                    </div>

                                    {/* Pressure Group */}
                                    <div>
                                        <div style={{
                                            fontSize: '11px',
                                            fontWeight: '600',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.8px',
                                            color: '#9ca3af',
                                            marginBottom: '8px',
                                            textAlign: 'center',
                                        }}>
                                            PRESSURE
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
                                            {/* Pressure */}
                                            <button
                                                onClick={() => toggleDataset(6)}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    padding: '6px 12px',
                                                    background: datasetVisibility[6] ? '#111827' : '#f1f5f9',
                                                    color: datasetVisibility[6] ? '#ffffff' : '#64748b',
                                                    border: datasetVisibility[6] ? 'none' : '1px solid #e2e8f0',
                                                    borderRadius: '6px',
                                                    fontSize: '12px',
                                                    fontWeight: '500',
                                                    cursor: 'pointer',
                                                    transition: 'all 150ms ease',
                                                }}
                                            >
                                                <Gauge size={14} />
                                                Pressure
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Chart */}
                                <div style={{ height: '400px' }}>
                                    <Line
                                        ref={chartRef}
                                        data={environmentChartData()}
                                        options={environmentChartOptions}
                                    />
                                </div>
                            </div>
                        )}


                        {/* Wet/Dry Fractions Chart */}
                        {fractionsChartData() && (
                            <ChartCard
                                title="Wet / Dry Fractions"
                                description="Proportion of sensors detecting wet vs. dry conditions by hour"
                            >
                                <div style={{ height: '300px' }}>
                                    <Bar data={fractionsChartData()} options={fractionsChartOptions} />
                                </div>
                            </ChartCard>
                        )}

                        {/* RH Heatmap */}
                        <ChartCard
                            title="Humidity Heatmap"
                            description="Relative humidity at each hour on the event day"
                        >
                            {renderHeatmap()}
                        </ChartCard>
                    </div>

                    {/* Detailed Environmental Data Table */}
                    {data.environment && data.environment.length > 0 && (
                        <div className="chart-card" style={{ marginBottom: '24px' }}>
                            <div className="chart-card-header">
                                <div className="chart-card-titles">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <TableIcon size={18} color="#3b82f6" />
                                        <h2 className="chart-card-title">Detailed Environmental Data</h2>
                                    </div>
                                    <p className="chart-card-subtitle">
                                        Hour-by-hour measurements from event start with all meteorological parameters
                                    </p>
                                </div>
                            </div>
                            <div className="chart-card-body">
                                <div
                                    style={{
                                        maxHeight: '480px',
                                        overflowY: 'auto',
                                        border: '1px solid #e5e7eb',
                                        borderRadius: '8px',
                                    }}
                                >
                                    <table
                                        style={{
                                            width: '100%',
                                            borderCollapse: 'collapse',
                                            fontSize: '13px',
                                        }}
                                    >
                                        <thead>
                                            <tr
                                                style={{
                                                    position: 'sticky',
                                                    top: 0,
                                                    background: '#f9fafb',
                                                    zIndex: 1,
                                                    borderBottom: '2px solid #e5e7eb',
                                                }}
                                            >
                                                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>
                                                    Hour
                                                </th>
                                                <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600', color: '#374151' }}>
                                                    RH (%)
                                                </th>
                                                <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600', color: '#374151' }}>
                                                    ΔT (°C)
                                                </th>
                                                <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600', color: '#374151' }}>
                                                    VPD (kPa)
                                                </th>
                                                <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600', color: '#374151' }}>
                                                    Wind (km/h)
                                                </th>
                                                <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600', color: '#374151' }}>
                                                    Dir (°)
                                                </th>
                                                <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600', color: '#374151' }}>
                                                    Gust (km/h)
                                                </th>
                                                <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600', color: '#374151' }}>
                                                    Pressure (hPa)
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {data.environment.map((row, idx) => (
                                                <tr
                                                    key={idx}
                                                    style={{
                                                        background: idx % 2 === 0 ? '#ffffff' : '#f9fafb',
                                                        borderBottom: '1px solid #f3f4f6',
                                                    }}
                                                >
                                                    <td style={{ padding: '10px 12px', color: '#111827', fontWeight: '500' }}>
                                                        {row.rel_hour}
                                                    </td>
                                                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#374151' }}>
                                                        {num(row.rh_mean, 1)}
                                                    </td>
                                                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#374151' }}>
                                                        {num(row.dp_spread_mean, 1)}
                                                    </td>
                                                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#374151' }}>
                                                        {num(row.vpd_mean, 2)}
                                                    </td>
                                                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#374151' }}>
                                                        {num(row.wind_mean, 1)}
                                                    </td>
                                                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#374151' }}>
                                                        {row.wind_direction_deg_mean != null ? num(row.wind_direction_deg_mean, 0) : '—'}
                                                    </td>
                                                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#374151' }}>
                                                        {row.wind_gusts_kmh_mean != null ? num(row.wind_gusts_kmh_mean, 1) : '—'}
                                                    </td>
                                                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#374151' }}>
                                                        {row.surface_pressure_hpa_mean != null ? num(row.surface_pressure_hpa_mean, 1) : '—'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
