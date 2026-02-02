import React from 'react';
import { Thermometer, Gauge, Clock } from 'lucide-react';

// Neumorphic styling constants
const neumorphicCard = "bg-slate-50 rounded-3xl shadow-[8px_8px_25px_rgba(15,23,42,0.08),-8px_-8px_25px_rgba(255,255,255,0.9)]";
const neumorphicInner = "bg-slate-50 rounded-2xl shadow-[inset_4px_4px_10px_rgba(15,23,42,0.1),inset_-4px_-4px_10px_rgba(255,255,255,0.9)]";

// === STORM SUMMARY CARD ===
export const StormSummaryCard = ({ eventType, description }) => {
    const getIcon = () => {
        switch (eventType) {
            case 'snow': return '❄️';
            case 'rain': return '🌧️';
            case 'mix': return '🌨️';
            default: return '☁️';
        }
    };

    return (
        <div className={`${neumorphicCard} p-6 border border-white/40`}>
            <div className="flex items-start gap-4">
                <div className={`${neumorphicInner} w-12 h-12 flex items-center justify-center text-2xl flex-shrink-0`}>
                    {getIcon()}
                </div>
                <div>
                    <h3 className="text-lg font-semibold text-slate-800 mb-2 capitalize">
                        Heavy vs Normal {eventType}
                    </h3>
                    <p className="text-sm text-slate-600 leading-relaxed">
                        {description}
                    </p>
                </div>
            </div>
        </div>
    );
};

// === TEMPERATURE TILE ===
export const TemperatureTile = ({ heavy, normal, eventType }) => {
    const diff = (heavy - normal).toFixed(1);
    const maxTemp = Math.max(heavy, normal);
    const minTemp = Math.min(heavy, normal);
    const range = 30; // Temperature range for visualization

    const heavyPercent = ((heavy + 10) / range) * 100;
    const normalPercent = ((normal + 10) / range) * 100;

    return (
        <div className={`${neumorphicCard} p-5`}>
            <div className="flex items-center gap-3 mb-4">
                <div className={`${neumorphicInner} w-12 h-12 flex items-center justify-center`}>
                    <Thermometer className="w-6 h-6 text-slate-600" />
                </div>
                <div className="flex-1">
                    <h4 className="text-sm font-semibold text-slate-600 mb-1">Temperature</h4>
                    <div className="text-2xl md:text-3xl font-bold text-slate-800">
                        +{diff}°C warmer
                    </div>
                </div>
            </div>

            <div className="text-xs md:text-sm text-slate-500 mb-3">
                Heavy {heavy > 0 ? '+' : ''}{heavy.toFixed(1)}°C · Normal {normal > 0 ? '+' : ''}{normal.toFixed(1)}°C
            </div>

            {/* Comparison bars */}
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 w-12">Heavy</span>
                    <div className="flex-1 h-3 bg-slate-200 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all duration-700"
                            style={{ width: `${Math.min(heavyPercent, 100)}%` }}
                        />
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 w-12">Normal</span>
                    <div className="flex-1 h-3 bg-slate-200 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-sky-400 to-sky-500 rounded-full transition-all duration-700"
                            style={{ width: `${Math.min(normalPercent, 100)}%` }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

// === PRESSURE TILE ===
export const PressureTile = ({ heavy, normal, eventType }) => {
    const diff = (normal - heavy).toFixed(1);
    const isSignificant = Math.abs(normal - heavy) > 5;

    // Map pressure to gauge angle (-90 to 90 degrees)
    const normalAngle = ((normal - 960) / 80) * 180 - 90;
    const heavyAngle = ((heavy - 960) / 80) * 180 - 90;

    const getMessage = () => {
        if (eventType === 'rain' && !isSignificant) {
            return 'No strong pressure signal';
        }
        return `${diff} hPa ${heavy < normal ? 'lower' : 'higher'}`;
    };

    return (
        <div className={`${neumorphicCard} p-5`}>
            <div className="flex items-center gap-3 mb-4">
                <div className={`${neumorphicInner} w-12 h-12 flex items-center justify-center`}>
                    <Gauge className="w-6 h-6 text-slate-600" />
                </div>
                <div className="flex-1">
                    <h4 className="text-sm font-semibold text-slate-600 mb-1">Pressure</h4>
                    <div className={`text-xl md:text-2xl font-bold ${isSignificant ? 'text-red-600' : 'text-slate-600'}`}>
                        {getMessage()}
                    </div>
                </div>
            </div>

            {/* Semi-circular gauge */}
            <div className="relative h-24 flex items-end justify-center">
                <svg width="160" height="80" viewBox="0 0 160 80" className="overflow-visible">
                    {/* Background arc */}
                    <path
                        d="M20 60 A 50 50 0 0 1 140 60"
                        stroke="#e2e8f0"
                        strokeWidth="12"
                        fill="none"
                        strokeLinecap="round"
                    />

                    {/* Significant delta arc */}
                    {isSignificant && (
                        <path
                            d="M20 60 A 50 50 0 0 1 140 60"
                            stroke="#ef4444"
                            strokeWidth="12"
                            fill="none"
                            strokeLinecap="round"
                            strokeDasharray="10 5"
                            opacity="0.4"
                        />
                    )}

                    {/* Normal needle */}
                    <line
                        x1="80"
                        y1="60"
                        x2={80 + 40 * Math.cos((normalAngle + 90) * Math.PI / 180)}
                        y2={60 - 40 * Math.sin((normalAngle + 90) * Math.PI / 180)}
                        stroke="#3b82f6"
                        strokeWidth="3"
                        strokeLinecap="round"
                    />

                    {/* Heavy needle */}
                    <line
                        x1="80"
                        y1="60"
                        x2={80 + 40 * Math.cos((heavyAngle + 90) * Math.PI / 180)}
                        y2={60 - 40 * Math.sin((heavyAngle + 90) * Math.PI / 180)}
                        stroke={isSignificant ? "#ef4444" : "#64748b"}
                        strokeWidth="3"
                        strokeLinecap="round"
                    />

                    <circle cx="80" cy="60" r="4" fill="#475569" />
                </svg>
            </div>

            <div className="flex justify-between text-xs text-slate-500 mt-2">
                <span>Normal {normal.toFixed(1)}</span>
                <span>Heavy {heavy.toFixed(1)}</span>
            </div>
        </div>
    );
};

// === EARLY DETECTION TILE ===
export const EarlyDetectionTile = ({ hours, reliability, precursor }) => {
    // Calculate arc fill (24+ = 90%, 12-24 = 65%)
    const arcPercent = hours >= 24 ? 90 : 65;
    const circumference = 2 * Math.PI * 45;
    const dashArray = `${(arcPercent / 100) * circumference} ${circumference}`;

    const color = reliability === 'High' ? '#22c55e' : '#f59e0b';
    const hoursLabel = hours >= 24 ? '24+ h' : '12–24 h';
    const precursorLabel = precursor === 'Surface Pressure' ? 'Surface Pressure' : 'Temperature';

    return (
        <div className={`${neumorphicCard} p-5`}>
            <div className="flex items-center gap-3 mb-4">
                <div className={`${neumorphicInner} w-12 h-12 flex items-center justify-center`}>
                    <Clock className="w-6 h-6 text-slate-600" />
                </div>
                <div className="flex-1">
                    <h4 className="text-sm font-semibold text-slate-600">Early Detection</h4>
                </div>
            </div>

            {/* Donut ring */}
            <div className="flex justify-center mb-4">
                <svg width="120" height="120" viewBox="0 0 120 120">
                    {/* Background ring */}
                    <circle
                        cx="60"
                        cy="60"
                        r="45"
                        stroke="#e2e8f0"
                        strokeWidth="10"
                        fill="none"
                    />

                    {/* Progress ring */}
                    <circle
                        cx="60"
                        cy="60"
                        r="45"
                        stroke={color}
                        strokeWidth="10"
                        fill="none"
                        strokeLinecap="round"
                        strokeDasharray={dashArray}
                        transform="rotate(-90 60 60)"
                        style={{
                            transition: 'all 0.8s ease',
                            filter: reliability === 'High' ? `drop-shadow(0 0 6px ${color})` : 'none'
                        }}
                    />

                    {/* Center text */}
                    <text
                        x="60"
                        y="55"
                        textAnchor="middle"
                        fontSize="20"
                        fontWeight="bold"
                        fill="#0f172a"
                    >
                        {hoursLabel}
                    </text>
                    <text
                        x="60"
                        y="72"
                        textAnchor="middle"
                        fontSize="12"
                        fill="#64748b"
                    >
                        {reliability}
                    </text>
                </svg>
            </div>

            <div className="text-xs text-center text-slate-600">
                Primary precursor: <span className="font-semibold">{precursorLabel}</span>
            </div>
        </div>
    );
};
