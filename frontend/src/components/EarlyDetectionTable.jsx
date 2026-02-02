import React from 'react';
import { AlertCircle, CheckCircle2, HelpCircle } from 'lucide-react';

export default function EarlyDetectionTable({ data, onHoverRow }) {
    const getReliabilityIcon = (level) => {
        if (level === 'High') return <CheckCircle2 size={16} className="text-green-500" />;
        if (level === 'Moderate') return <HelpCircle size={16} className="text-yellow-500" />;
        return <AlertCircle size={16} className="text-slate-400" />;
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-100">
                <h3 className="text-lg font-bold text-slate-800">Early Detection Capabilities</h3>
                <p className="text-sm text-slate-500 mt-1">
                    Heavy Snow and Heavy Mix can be anticipated from pressure and temperature up to 24+ hours ahead.
                </p>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                            <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Event Type</th>
                            <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Primary Precursor</th>
                            <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Earliest Detection</th>
                            <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Reliability</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {data.map((row, idx) => (
                            <tr
                                key={idx}
                                className="hover:bg-blue-50/50 transition-colors cursor-default"
                                onMouseEnter={() => onHoverRow && onHoverRow(row.eventType)}
                                onMouseLeave={() => onHoverRow && onHoverRow(null)}
                            >
                                <td className="py-4 px-6 text-sm font-semibold text-slate-900">{row.eventType}</td>
                                <td className="py-4 px-6 text-sm text-slate-600">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                                        {row.precursor}
                                    </span>
                                </td>
                                <td className="py-4 px-6 text-sm text-slate-600">{row.earliestDetection}</td>
                                <td className="py-4 px-6 text-sm text-slate-600">
                                    <div className="flex items-center gap-2">
                                        {getReliabilityIcon(row.reliability)}
                                        <span>{row.reliability}</span>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
