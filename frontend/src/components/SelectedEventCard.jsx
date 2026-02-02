import React from 'react';
import { Thermometer, Gauge, Clock, Shield, ArrowRight, Info, CheckCircle2, HelpCircle, AlertCircle, ChevronDown, TrendingUp, Activity } from 'lucide-react';

// Mini Chart Component (Simulated with CSS for performance/simplicity)
const MiniChart = ({ type, value, max }) => {
    const height = Math.min(100, Math.max(20, (value / max) * 100));
    return (
        <div className="h-12 w-full flex items-end gap-1 mt-2 opacity-50">
            {[0.6, 0.8, 0.4, 0.9, 0.5, 1.0, 0.7].map((h, i) => (
                <div
                    key={i}
                    className={`flex-1 rounded-t-sm ${type === 'heavy' ? 'bg-amber-500' : 'bg-blue-500'}`}
                    style={{ height: `${h * height}%` }}
                />
            ))}
        </div>
    );
};

export default function SelectedEventCard({ data, selectedEvent }) {
    const family = selectedEvent?.family || 'snow';

    // Always compare Heavy vs Normal for the current family
    const heavyData = data[family].heavy;
    const normalData = data[family].normal;

    // Calculate differences
    const tempDiff = heavyData.tempC - normalData.tempC;
    const tempDiffText = tempDiff > 0 ? `${tempDiff.toFixed(1)}°C warmer` : `${Math.abs(tempDiff).toFixed(1)}°C cooler`;

    const pressDiff = heavyData.pressureHpa - normalData.pressureHpa;
    const pressDiffText = pressDiff < 0 ? `${Math.abs(pressDiff).toFixed(1)} hPa lower` : `${pressDiff.toFixed(1)} hPa higher`;

    const getReliabilityIcon = (level) => {
        if (level === 'High') return <CheckCircle2 size={16} className="text-green-500" />;
        if (level === 'Moderate') return <HelpCircle size={16} className="text-yellow-500" />;
        return <AlertCircle size={16} className="text-slate-400" />;
    };

    return (
        <div className="flex flex-col gap-6 h-full">
            {/* Title Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                <div className="flex items-center gap-3 mb-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-bold uppercase tracking-wide">
                        Comparison
                    </span>
                    <span className="text-slate-400 text-xs font-medium">Based on historical data</span>
                </div>
                <h2 className="text-3xl font-bold text-slate-900">
                    Heavy {family.charAt(0).toUpperCase() + family.slice(1)} <span className="text-slate-400 font-light">vs</span> Normal
                </h2>
            </div>

            {/* Big Numeric Chips */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Temperature */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-shadow">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Thermometer size={48} className="text-blue-600" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 text-slate-500 text-sm font-medium mb-1">
                            <Thermometer size={16} /> Temperature
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-bold text-slate-900">{heavyData.tempC > 0 ? '+' : ''}{heavyData.tempC}°</span>
                            <span className="text-sm text-slate-400">vs {normalData.tempC > 0 ? '+' : ''}{normalData.tempC}°</span>
                        </div>
                        <div className={`mt-2 inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold ${tempDiff > 0 ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
                            {tempDiff > 0 ? <TrendingUp size={12} /> : <TrendingUp size={12} className="rotate-180" />}
                            {tempDiffText}
                        </div>
                    </div>
                    <MiniChart type="heavy" value={70} max={100} />
                </div>

                {/* Pressure */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-shadow">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Gauge size={48} className="text-purple-600" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 text-slate-500 text-sm font-medium mb-1">
                            <Gauge size={16} /> Pressure
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-bold text-slate-900">{heavyData.pressureHpa}</span>
                            <span className="text-sm text-slate-400">vs {normalData.pressureHpa}</span>
                        </div>
                        <div className="mt-2 inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold bg-amber-50 text-amber-700">
                            <Activity size={12} />
                            {pressDiffText}
                        </div>
                    </div>
                    <MiniChart type="heavy" value={40} max={100} />
                </div>

                {/* Detection */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-shadow">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Shield size={48} className="text-green-600" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 text-slate-500 text-sm font-medium mb-1">
                            <Clock size={16} /> Lead Time
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-bold text-slate-900">24+ h</span>
                            <span className="text-sm text-slate-400">vs 12h</span>
                        </div>
                        <div className="mt-2 inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold bg-green-50 text-green-700">
                            <CheckCircle2 size={12} />
                            High Reliability
                        </div>
                    </div>
                    <div className="h-12 w-full flex items-center gap-1 mt-2 opacity-50">
                        <div className="h-2 flex-1 bg-green-500 rounded-full"></div>
                        <div className="h-2 w-1/3 bg-slate-200 rounded-full"></div>
                    </div>
                </div>
            </div>

            {/* Scientific Summary & Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex-1">
                <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <Info size={20} className="text-blue-500" />
                    Analysis & Detection
                </h3>

                <div className="space-y-4">
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <h4 className="font-bold text-slate-800 text-sm mb-2">Event Signature</h4>
                        <p className="text-sm text-slate-600 leading-relaxed">
                            <strong>Heavy {family}</strong> events are characterized by {pressDiff < -5 ? 'significantly lower pressure' : 'distinct pressure anomalies'} and {tempDiff > 0 ? 'warmer' : 'cooler'} temperatures compared to normal events.
                            The deep low pressure system typically indicates a stronger lifting mechanism, resulting in higher precipitation intensity.
                        </p>
                    </div>

                    <div className="overflow-hidden rounded-xl border border-slate-200">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-100 text-slate-500 font-semibold">
                                <tr>
                                    <th className="px-4 py-3">Precursor Signal</th>
                                    <th className="px-4 py-3">Detection Window</th>
                                    <th className="px-4 py-3">Reliability</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                <tr className="bg-white">
                                    <td className="px-4 py-3 font-medium text-slate-900">Pressure Drop (&gt;10hPa)</td>
                                    <td className="px-4 py-3 text-slate-600">24-48 hours</td>
                                    <td className="px-4 py-3 flex items-center gap-1.5">{getReliabilityIcon('High')} High</td>
                                </tr>
                                <tr className="bg-white">
                                    <td className="px-4 py-3 font-medium text-slate-900">Temp. Deviation</td>
                                    <td className="px-4 py-3 text-slate-600">12-24 hours</td>
                                    <td className="px-4 py-3 flex items-center gap-1.5">{getReliabilityIcon('Moderate')} Moderate</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
