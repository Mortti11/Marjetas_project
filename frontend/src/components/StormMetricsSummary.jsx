import React from 'react';
import { Thermometer, Gauge, Clock, ArrowRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';

const MetricCard = ({ label, icon: Icon, heavyVal, normalVal, unit, diffText, diffType, color }) => {
    // Calculate a simple percentage for the visual bar
    const maxVal = Math.max(Math.abs(heavyVal), Math.abs(normalVal)) * 1.2 || 1;
    const heavyPct = Math.min(100, Math.max(10, (Math.abs(heavyVal) / maxVal) * 100));
    const normalPct = Math.min(100, Math.max(10, (Math.abs(normalVal) / maxVal) * 100));

    return (
        <div className="bg-slate-50 rounded-xl p-5 border border-slate-100 flex flex-col justify-between h-full hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase tracking-wider mb-4">
                <Icon size={14} /> {label}
            </div>

            <div className="space-y-4">
                {/* Heavy Value */}
                <div>
                    <div className="flex justify-between items-end mb-1">
                        <span className="text-xs font-semibold text-slate-400">Heavy</span>
                        <span className={`text-xl font-bold ${color === 'amber' ? 'text-amber-600' : color === 'blue' ? 'text-blue-600' : 'text-slate-700'}`}>
                            {heavyVal > 0 && label === 'Temperature' ? '+' : ''}{heavyVal} <span className="text-xs font-normal text-slate-400">{unit}</span>
                        </span>
                    </div>
                    <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full ${color === 'amber' ? 'bg-amber-500' : color === 'blue' ? 'bg-blue-500' : 'bg-slate-500'}`}
                            style={{ width: `${heavyPct}%` }}
                        />
                    </div>
                </div>

                {/* Normal Value */}
                <div>
                    <div className="flex justify-between items-end mb-1">
                        <span className="text-xs font-semibold text-slate-400">Normal</span>
                        <span className="text-sm font-semibold text-slate-600">
                            {normalVal > 0 && label === 'Temperature' ? '+' : ''}{normalVal} <span className="text-xs font-normal text-slate-400">{unit}</span>
                        </span>
                    </div>
                    <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                        <div
                            className="h-full rounded-full bg-slate-400/50"
                            style={{ width: `${normalPct}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Difference Badge */}
            <div className={`mt-5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold w-fit ${diffType === 'warmer' ? 'bg-red-100 text-red-700' :
                    diffType === 'cooler' ? 'bg-blue-100 text-blue-700' :
                        diffType === 'lower' ? 'bg-orange-100 text-orange-700' :
                            diffType === 'higher' ? 'bg-emerald-100 text-emerald-700' :
                                'bg-slate-200 text-slate-700'
                }`}>
                {diffType === 'warmer' || diffType === 'higher' ? <TrendingUp size={12} /> :
                    diffType === 'cooler' || diffType === 'lower' ? <TrendingDown size={12} /> : <Minus size={12} />}
                {diffText}
            </div>
        </div>
    );
};

export default function StormMetricsSummary({ data, selectedEvent }) {
    const family = selectedEvent?.family || 'snow';
    const heavyData = data[family].heavy;
    const normalData = data[family].normal;

    // Calculations
    const tempDiff = heavyData.tempC - normalData.tempC;
    const tempDiffText = `${Math.abs(tempDiff).toFixed(1)}°C ${tempDiff > 0 ? 'warmer' : 'cooler'}`;

    const pressDiff = (heavyData.pressureHpa || 0) - (normalData.pressureHpa || 0);
    const pressDiffText = `${Math.abs(pressDiff).toFixed(1)} hPa ${pressDiff < 0 ? 'lower' : 'higher'}`;

    return (
        <div className="h-full flex flex-col gap-4">
            <MetricCard
                label="Temperature"
                icon={Thermometer}
                heavyVal={heavyData.tempC}
                normalVal={normalData.tempC}
                unit="°C"
                diffText={tempDiffText}
                diffType={tempDiff > 0 ? 'warmer' : 'cooler'}
                color="blue"
            />
            <MetricCard
                label="Pressure"
                icon={Gauge}
                heavyVal={heavyData.pressureHpa || 0}
                normalVal={normalData.pressureHpa || 0}
                unit="hPa"
                diffText={pressDiffText}
                diffType={pressDiff < 0 ? 'lower' : 'higher'}
                color="amber"
            />
            <div className="bg-slate-50 rounded-xl p-5 border border-slate-100 flex flex-col justify-between h-full hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase tracking-wider mb-3">
                    <Clock size={14} /> Lead Time
                </div>

                <div className="space-y-4">
                    <div>
                        <div className="text-xs font-semibold text-slate-400 mb-1">Detection Window</div>
                        <div className="text-2xl font-bold text-slate-800">24+ <span className="text-sm font-normal text-slate-500">hours</span></div>
                    </div>

                    <div>
                        <div className="text-xs font-semibold text-slate-400 mb-1">Reliability</div>
                        <div className="flex items-center gap-2">
                            <div className="flex gap-1">
                                <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
                                <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
                                <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
                                <div className="w-2.5 h-2.5 rounded-full bg-slate-300"></div>
                            </div>
                            <span className="text-sm font-bold text-slate-700">High</span>
                        </div>
                    </div>
                </div>

                <div className="mt-4 px-3 py-1.5 rounded-lg bg-green-100 text-green-700 text-xs font-bold w-fit flex items-center gap-1">
                    <ArrowRight size={12} /> Early Warning
                </div>
            </div>
        </div>
    );
}
