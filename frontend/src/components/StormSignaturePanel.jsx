import React, { Suspense, useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Bar } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';
import StormAvatar from './StormAvatar';
import { Loader2, LayoutTemplate, Box, Info } from 'lucide-react';

// Register ChartJS components
ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
);

export default function StormSignaturePanel({ selectedEvent, data }) {
    const [viewMode, setViewMode] = useState('3d'); // '3d' or '2d'
    const [hasError, setHasError] = useState(false);

    // Error boundary for WebGL context loss
    useEffect(() => {
        const handleContextLost = (event) => {
            event.preventDefault();
            setHasError(true);
            setViewMode('2d');
        };
        const canvas = document.querySelector('canvas');
        if (canvas) {
            canvas.addEventListener('webglcontextlost', handleContextLost, false);
        }
        return () => {
            if (canvas) canvas.removeEventListener('webglcontextlost', handleContextLost);
        };
    }, []);

    const family = selectedEvent?.family || 'snow';
    const heavyData = data[family]?.heavy;
    const normalData = data[family]?.normal;

    // Dynamic Background Gradient
    const getGradient = () => {
        switch (family) {
            case 'snow': return 'from-sky-100 to-slate-50';
            case 'mix': return 'from-indigo-100 to-slate-50';
            case 'rain': return 'from-blue-100 to-slate-50';
            default: return 'from-slate-100 to-slate-50';
        }
    };

    // Chart.js Data for 2D Mode
    const chartData = {
        labels: ['Temperature (°C)', 'Pressure (hPa)', 'Precip (mm/h)'],
        datasets: [
            {
                label: `Normal ${family}`,
                data: [normalData?.tempC || 0, normalData?.pressureHpa || 0, 2],
                backgroundColor: 'rgba(59, 130, 246, 0.7)', // Blue
                borderRadius: 4,
            },
            {
                label: `Heavy ${family}`,
                data: [heavyData?.tempC || 0, heavyData?.pressureHpa || 0, 5],
                backgroundColor: 'rgba(245, 158, 11, 0.7)', // Amber
                borderRadius: 4,
            },
        ],
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'top' },
            title: { display: false },
        },
        scales: {
            y: { beginAtZero: true, grid: { color: '#f1f5f9' } },
            x: { grid: { display: false } }
        }
    };

    return (
        <div className={`relative flex flex-col h-full rounded-2xl overflow-hidden bg-gradient-to-b ${getGradient()}`}>
            {/* Header / Controls */}
            <div className="absolute top-4 right-4 z-10">
                {/* Segmented Control */}
                <div className="flex bg-white/60 backdrop-blur-md p-1 rounded-lg border border-white/40 shadow-sm">
                    <button
                        onClick={() => setViewMode('2d')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === '2d' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <LayoutTemplate size={14} /> 2D
                    </button>
                    <button
                        onClick={() => setViewMode('3d')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === '3d' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Box size={14} /> 3D
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 w-full relative min-h-[400px]">
                {viewMode === '3d' && !hasError ? (
                    <Suspense fallback={
                        <div className="absolute inset-0 flex items-center justify-center text-slate-500">
                            <Loader2 className="animate-spin mr-2" /> Loading 3D Scene...
                        </div>
                    }>
                        <Canvas camera={{ position: [0, 1, 8], fov: 40 }}>
                            <StormAvatar
                                type={family}
                                isHeavy={selectedEvent.intensity === 'heavy'}
                                data={selectedEvent.intensity === 'heavy' ? heavyData : normalData}
                            />
                            <OrbitControls
                                enableZoom={false}
                                enablePan={false}
                                minPolarAngle={Math.PI / 3}
                                maxPolarAngle={Math.PI / 2}
                            />
                        </Canvas>
                    </Suspense>
                ) : (
                    <div className="p-6 h-full pt-16">
                        <div className="bg-white/50 backdrop-blur-sm rounded-2xl p-4 h-full border border-white/40 shadow-sm">
                            <Bar options={chartOptions} data={chartData} />
                        </div>
                    </div>
                )}
            </div>

            {/* Explanatory Legend (Static) */}
            <div className="bg-white/40 backdrop-blur-md border-t border-white/20 p-4 text-xs text-slate-600 space-y-1">
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                    <span>Particle density ∝ <strong>Precipitation (mm/h)</strong></span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                    <span>Cloud height & darkness ∝ <strong>Pressure Anomaly</strong></span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                    <span>Ring size & glow ∝ <strong>Detection Window</strong></span>
                </div>
            </div>
        </div>
    );
}
