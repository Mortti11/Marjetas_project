import React from 'react';
import { Thermometer, Gauge, Clock } from 'lucide-react';

export default function StormSignaturesSidebar({ data, focusedEvent }) {
    // Default to showing Heavy Snow if nothing focused
    const activeFamily = focusedEvent?.family || 'snow';
    const activeIntensity = focusedEvent?.intensity || 'heavy';

    const currentData = data[activeFamily][activeIntensity];
    const compareIntensity = activeIntensity === 'heavy' ? 'normal' : 'heavy';
    const compareData = data[activeFamily][compareIntensity];

    const getDelta = (val1, val2) => {
        if (val1 === undefined || val2 === undefined) return null;
        const diff = val1 - val2;
        return `${diff > 0 ? '+' : ''}${diff.toFixed(1)}`;
    };

    const tempDelta = getDelta(currentData.tempC, compareData.tempC);

    // Pressure delta logic
    let pressDelta = null;
    if (currentData.pressureDeltaHpa !== undefined) {
        pressDelta = `${currentData.pressureDeltaHpa > 0 ? '+' : ''}${currentData.pressureDeltaHpa}`;
    } else if (currentData.pressureHpa && compareData.pressureHpa) {
        pressDelta = getDelta(currentData.pressureHpa, compareData.pressureHpa);
    }

    const MetricRow = ({ icon: Icon, label, mainValue, subText, delta }) => (
        <div className="flex items-start gap-3 py-3 border-b border-slate-50 last:border-0">
            <div className="mt-0.5 text-slate-400">
                <Icon size={16} />
            </div>
            <div className="flex-1">
                <div className="flex items-baseline justify-between mb-0.5">
                    <span className="text-sm font-semibold text-slate-700">{label}</span>
                    {delta && (
                        <span className={`text-xs font-bold ${delta.includes('+') ? 'text-red-500' : 'text-blue-500'}`}>
                            Diff: {delta}
                        </span>
                    )}
                </div>
                <div className="text-sm font-medium text-slate-900">{mainValue}</div>
                <div className="text-xs text-slate-500 mt-0.5">{subText}</div>
            </div>
        </div>
    );

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 h-full flex flex-col p-5">
            <div className="mb-4">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Selected Event
                </div>
                <div className="flex items-center gap-2">
                    <div
                        className="w-3 h-3 rounded-full shadow-sm"
                        style={{ backgroundColor: currentData.color }}
                    />
                    <h2 className="text-lg font-bold text-slate-800">
                        {currentData.label}
                    </h2>
                </div>
                <div className="text-xs text-slate-500 mt-1 ml-5">
                    vs {compareData.label}
                </div>
            </div>

            <div className="space-y-1">
                <MetricRow
                    icon={Thermometer}
                    label="Temperature"
                    mainValue={`Heavy: ${currentData.tempC > 0 ? '+' : ''}${currentData.tempC}°C`}
                    subText={`Normal: ${compareData.tempC > 0 ? '+' : ''}${compareData.tempC}°C`}
                    delta={tempDelta ? `${tempDelta}°C` : null}
                />
                <MetricRow
                    icon={Gauge}
                    label="Pressure"
                    mainValue={currentData.pressureHpa ? `Heavy: ${currentData.pressureHpa} hPa` : (currentData.pressureDeltaHpa ? `Heavy: ${currentData.pressureDeltaHpa} hPa (Δ)` : '—')}
                    subText={compareData.pressureHpa ? `Normal: ${compareData.pressureHpa} hPa` : '—'}
                    delta={pressDelta ? `${pressDelta} hPa` : null}
                />
                <MetricRow
                    icon={Clock}
                    label="Early Detection"
                    mainValue={activeIntensity === 'heavy' ? 'Earliest: 24+ hours' : '—'}
                    subText="Reliability: High"
                />
            </div>
        </div>
    );
}
