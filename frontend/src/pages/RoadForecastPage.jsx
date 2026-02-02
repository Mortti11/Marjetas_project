import React, { useEffect, useState } from 'react';
import { CloudRain, Snowflake, CloudDrizzle } from 'lucide-react';
import './Pages.css';

export default function RoadForecastPage() {
    const [forecast, setForecast] = useState(null);
    const [events, setEvents] = useState([]);
    const [highPeriods24, setHighPeriods24] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetch('/api/road-forecast/city?forecast_days=3')
            .then(r => r.ok ? r.json() : Promise.reject(new Error('Failed to fetch road forecast')))
            .then(data => {
                setForecast(data);
                setEvents(data.events || []);
                setHighPeriods24(data.stats?.high_risk_periods_24h ?? []);
                setLoading(false);
            })
            .catch(err => {
                setError(err.message);
                setLoading(false);
            });
    }, []);

    // Group events by date
    const eventsByDate = React.useMemo(() => {
        if (!events) return [];
        const groups = new Map();

        const formatDateKey = (ts) => {
            const d = new Date(ts);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        };

        const formatDateLabel = (key) => {
            const [y, m, d] = key.split('-');
            const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
            return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        };

        for (const ev of events) {
            const key = formatDateKey(ev.start_ts);
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(ev);
        }

        return Array.from(groups.entries()).map(([key, evs]) => {
            const [y, m, d] = key.split('-');
            const dateObj = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
            const today = new Date();
            const isToday = dateObj.getDate() === today.getDate() &&
                dateObj.getMonth() === today.getMonth() &&
                dateObj.getFullYear() === today.getFullYear();

            let label = formatDateLabel(key);
            if (isToday) {
                label = (
                    <>
                        <span className="road-date-today-pill">Today</span> • {label}
                    </>
                );
            }

            return {
                dateKey: key,
                label: label,
                events: evs.sort((a, b) => new Date(a.start_ts) - new Date(b.start_ts)),
            };
        }).sort((a, b) => a.dateKey.localeCompare(b.dateKey));
    }, [events]);

    if (loading) {
        return (
            <div className="page page--road">
                <div className="road-page">
                    <div className="page-loading">Loading road forecast...</div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="page page--road">
                <div className="road-page">
                    <div className="page-error">Error: {error}</div>
                </div>
            </div>
        );
    }

    const stats = forecast?.stats || {};
    const hourly24 = forecast?.hourly?.slice(0, 24) || [];
    const generatedAt = forecast?.generated_at;

    // Derive overall risk level
    const maxScore24h = stats.max_slippery_score_24h ?? 0;
    let riskLevel = 'low';
    let riskLabel = 'Low risk';

    if (maxScore24h >= 80) {
        riskLevel = 'high';
        riskLabel = 'High risk';
    } else if (maxScore24h >= 40) {
        riskLevel = 'medium';
        riskLabel = 'Medium risk';
    }

    const formatHour = (ts) => {
        return new Date(ts).toLocaleTimeString([], {
            hour: "2-digit",
            hour12: false,
        }).replace(':', '');
    };

    const formatGeneratedAt = (ts) => {
        if (!ts) return '';
        return new Date(ts).toLocaleString("fi-FI", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const formatEventRange = (start, end) => {
        const s = new Date(start);
        const e = new Date(end);
        const fmt = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        return `${fmt(s)} – ${fmt(e)}`;
    };

    const getPrecipIcon = (ptype) => {
        if (ptype === 'Snow') return <Snowflake size={16} />;
        if (ptype === 'Mix') return <CloudDrizzle size={16} />;
        return <CloudRain size={16} />;
    };

    // Helper to format time as HH:mm
    const formatTimeHHmm = (iso) => {
        const d = new Date(iso);
        // Force HH:mm format with colon
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
    };

    // Helper to format a high-risk period string (value only)
    const formatHighPeriodValue = (p) => {
        const startDate = new Date(p.start_ts);
        const endDate = new Date(startDate.getTime() + p.duration_h * 60 * 60 * 1000);

        const start = formatTimeHHmm(p.start_ts);
        const end = formatTimeHHmm(endDate.toISOString());
        const hours = Math.round(p.duration_h);
        const maxScore = Math.round(p.max_score ?? stats?.max_slippery_score_24h ?? 0);
        return `${start}–${end} (${hours} h, max score ${maxScore})`;
    };

    // Check if an hour falls within any high-risk period
    const isHighHour = (hourIso) => {
        return highPeriods24.some(
            (p) => hourIso >= p.start_ts && hourIso <= p.end_ts
        );
    };

    return (
        <main className="page page--road">
            <div className="road-page">
                <header className="page-header">
                    <div>
                        <h1>Road Forecast</h1>
                        <p className="page-subtitle">
                            Slippery road conditions and precipitation events for Jyväskylä (next 3 days)
                        </p>
                    </div>
                </header>

                {/* Summary Card */}
                <section className="card-road-summary">
                    <h2 className="road-section-title">Road slipperiness summary (next 24–72 h)</h2>
                    <div className="road-summary-grid">
                        <div className="road-summary-col">
                            <div className="road-summary-label">Overall risk (24h)</div>
                            <div className={`road-risk-pill road-risk-pill--${riskLevel}`}>
                                {riskLabel}
                            </div>
                        </div>
                        <div className="road-summary-col road-summary-col--center">
                            <div className="road-summary-label">Max score (24h)</div>
                            <div className="road-summary-value">{maxScore24h}/100</div>
                        </div>
                        <div className="road-summary-col road-summary-col--right">
                            <div className="road-summary-label">High-risk hours</div>
                            <div className="road-summary-sub">24h: {stats.high_risk_hours_24h || 0}</div>
                            <div className="road-summary-sub">72h: {stats.high_risk_hours_72h || 0}</div>
                        </div>
                    </div>

                    {/* High-risk periods summary */}
                    {highPeriods24.length > 0 && (
                        <div className="road-summary-highrisk">
                            <div className="label">High-risk window{highPeriods24.length > 1 ? 's' : ''}</div>
                            {highPeriods24.length === 1 ? (
                                <div className="value">{formatHighPeriodValue(highPeriods24[0])}</div>
                            ) : (
                                <ul className="value-list">
                                    {highPeriods24.map((p) => (
                                        <li key={`${p.start_ts}-${p.end_ts}`}>
                                            {formatHighPeriodValue(p)}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}
                </section>

                {/* Next 24h slippery risk */}
                <section className="road-ribbon-card">
                    <div className="road-ribbon-header">
                        <div className="road-ribbon-title">Next 24h slippery risk (hour-by-hour)</div>
                        <div className="road-hourly-legend">
                            <span><span className="road-legend-dot road-legend-dot--low" /> Low</span>
                            <span><span className="road-legend-dot road-legend-dot--medium" /> Medium</span>
                            <span><span className="road-legend-dot road-legend-dot--high" /> High</span>
                        </div>
                    </div>

                    <div className="road-ribbon-chips">
                        {hourly24.map((h) => {
                            const level = h.slippery_level || 'low';
                            const hourLabel = formatHour(h.timestamp);
                            const isHigh = isHighHour(h.timestamp);

                            return (
                                <div
                                    key={h.timestamp}
                                    className={`road-ribbon-chip road-ribbon-chip--${level}${isHigh ? ' road-ribbon-chip--high-period' : ''}`}
                                    title={`${hourLabel}: ${h.temp_C.toFixed(1)}°C, ${level} (score ${h.slippery_score})`}
                                >
                                    {hourLabel}
                                    {isHigh && <div className="road-ribbon-chip-high-label">HIGH</div>}
                                </div>
                            );
                        })}
                    </div>

                    <div className="road-ribbon-updated">
                        Updated {formatGeneratedAt(generatedAt)}
                    </div>
                </section>

                {/* Upcoming events section */}
                <section className="road-events-card">
                    <h2 className="road-section-title">Upcoming events (next 3 days)</h2>

                    <div className="road-events-header">
                        <span>Time &amp; precipitation</span>
                        <span>Type &amp; drying</span>
                    </div>

                    {(!events || events.length === 0) && (
                        <p className="road-empty-text">No precipitation events in the next 3 days.</p>
                    )}

                    {eventsByDate.map((group) => (
                        <div key={group.dateKey} className="road-events-day">
                            <div className="road-events-day-label">{group.label}</div>
                            <div className="road-events-list">
                                {group.events.map((ev) => {
                                    const intensity = ev.event_intensity || 'light';
                                    const type = ev.ptype_main || 'Rain';
                                    const dryingText = ev.drying_hours_from_end != null
                                        ? `Drying: ~ ${Math.round(ev.drying_hours_from_end)} h`
                                        : 'Drying: unknown';

                                    const severityClass =
                                        intensity === 'heavy' || intensity === 'extreme'
                                            ? 'heavy'
                                            : intensity === 'moderate'
                                                ? 'moderate'
                                                : 'light';

                                    return (
                                        <article
                                            key={ev.event_id}
                                            className={`road-event-row road-event-row--${severityClass}`}
                                        >
                                            <div className="road-event-left">
                                                <div className="road-event-left-main">
                                                    {formatEventRange(ev.start_ts, ev.end_ts)}
                                                </div>
                                                <div className="road-event-left-sub">
                                                    Total precip: {ev.mm_total.toFixed(1)} mm
                                                </div>
                                            </div>

                                            <div className="road-event-right">
                                                <div className="road-event-type-row">
                                                    <span className="road-event-icon">{getPrecipIcon(ev.ptype_main)}</span>
                                                    <span className="road-event-type-text">{type}, {intensity}</span>
                                                </div>
                                                <div className="road-event-drying-row">{dryingText}</div>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </section>
            </div>
        </main>
    );
}
