import React, { useRef, useState, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';

// ========== CONFIGURATION ==========
const METRIC_COLORS = {
    temp: '#ff9f43',
    humidity: '#4285f4',
    pressure: '#6c5ce7',
    wind: '#00b894',
} as const;

const METRIC_LABELS = {
    temp: 'Temperature',
    humidity: 'Humidity',
    pressure: 'Pressure',
    wind: 'Wind',
} as const;

const METRIC_UNITS = {
    temp: '°C',
    humidity: '%',
    pressure: 'hPa',
    wind: 'km/h',
} as const;

// TODO: Replace with actual API call
const STORM_STATS = [
    { type: 'Mix', temp: -1.9, humidity: 98.5, pressure: 984.9, wind: 15.9 },
    { type: 'Heavy Rain', temp: 15.3, humidity: 93.0, pressure: 990.4, wind: 12.7 },
    { type: 'Normal', temp: 8.9, humidity: 87.0, pressure: 995.9, wind: 11.6 },
];

type MetricKey = keyof typeof METRIC_COLORS;
type EventType = 'Mix' | 'Heavy Rain' | 'Normal';
type StormStat = typeof STORM_STATS[0];

// ========== UTILITY FUNCTIONS ==========
function normalizeMetrics(stats: StormStat[]) {
    const metrics: MetricKey[] = ['temp', 'humidity', 'pressure', 'wind'];
    const normalized: Record<string, Record<MetricKey, number>> = {};

    metrics.forEach((metric) => {
        const values = stats.map((s) => s[metric]);
        const min = Math.min(...values);
        const max = Math.max(...values);
        const range = max - min || 1;

        stats.forEach((stat) => {
            if (!normalized[stat.type]) normalized[stat.type] = {} as Record<MetricKey, number>;
            // Normalize to 0.2-1.0 range (avoid zero height)
            normalized[stat.type][metric] = 0.2 + ((stat[metric] - min) / range) * 0.8;
        });
    });

    return normalized;
}

// ========== 3D COMPONENTS ==========
interface SegmentProps {
    position: [number, number, number];
    scale: [number, number, number];
    color: string;
    delay: number;
    isHovered: boolean;
    isPulsing: boolean;
    isFaded: boolean;
}

function Segment({ position, scale, color, delay, isHovered, isPulsing, isFaded }: SegmentProps) {
    const meshRef = useRef<THREE.Mesh>(null);
    const [animProgress, setAnimProgress] = useState(0);
    const pulsePhase = useRef(0);

    useFrame((state, delta) => {
        if (!meshRef.current) return;

        // Entry animation
        if (animProgress < 1) {
            const newProgress = Math.min(animProgress + delta / 0.6, 1);
            setAnimProgress(newProgress);

            const delayed = Math.max(0, (newProgress * 1.2) - delay);
            const eased = delayed < 1 ? 1 - Math.pow(1 - delayed, 3) : 1;
            const overshoot = eased < 1 ? eased * 1.05 : 1 + (1 - eased) * 0.05;

            meshRef.current.scale.y = scale[1] * overshoot;
        }

        // Pulsing animation when metric is selected
        if (isPulsing) {
            pulsePhase.current += delta * 2;
            const pulse = 1 + Math.sin(pulsePhase.current) * 0.025;
            meshRef.current.scale.x = scale[0] * pulse;
            meshRef.current.scale.z = scale[2] * pulse;
        } else {
            meshRef.current.scale.x = scale[0];
            meshRef.current.scale.z = scale[2];
        }

        // Opacity for fading
        const material = meshRef.current.material as THREE.MeshStandardMaterial;
        material.opacity = isFaded ? 0.3 : 1;
    });

    const baseColor = new THREE.Color(color);
    const emissiveIntensity = isHovered ? 0.3 : 0.1;

    return (
        <mesh ref={meshRef} position={position}>
            <boxGeometry args={[scale[0], 0.01, scale[2]]} />
            <meshStandardMaterial
                color={baseColor}
                emissive={baseColor}
                emissiveIntensity={emissiveIntensity}
                transparent
                opacity={1}
            />
        </mesh>
    );
}

interface TowerProps {
    eventType: EventType;
    normalizedData: Record<MetricKey, number>;
    rawData: StormStat;
    xPosition: number;
    hoveredTower: EventType | null;
    onHover: (type: EventType | null) => void;
    selectedMetric: MetricKey | 'all';
    focusedEvent: EventType | null;
}

function Tower({
    eventType,
    normalizedData,
    rawData,
    xPosition,
    hoveredTower,
    onHover,
    selectedMetric,
    focusedEvent,
}: TowerProps) {
    const groupRef = useRef<THREE.Group>(null);
    const isHovered = hoveredTower === eventType;
    const isFaded = focusedEvent !== null && focusedEvent !== eventType;

    const segments: Array<{ metric: MetricKey; height: number; yPos: number }> = [];
    let currentY = 0;
    const metrics: MetricKey[] = ['temp', 'humidity', 'pressure', 'wind'];

    metrics.forEach((metric) => {
        const height = normalizedData[metric];
        segments.push({ metric, height, yPos: currentY + height / 2 });
        currentY += height;
    });

    useFrame(() => {
        if (!groupRef.current) return;
        const targetScale = isHovered ? 1.05 : 1;
        groupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);

        const targetOpacity = isFaded ? 0.6 : 1;
        groupRef.current.children.forEach((child) => {
            if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
                child.material.opacity = THREE.MathUtils.lerp(child.material.opacity, targetOpacity, 0.1);
            }
        });
    });

    return (
        <group
            ref={groupRef}
            position={[xPosition, 0, 0]}
            onPointerEnter={() => onHover(eventType)}
            onPointerLeave={() => onHover(null)}
        >
            {segments.map(({ metric, height, yPos }, idx) => {
                const isPulsing = selectedMetric !== 'all' && selectedMetric === metric;
                const isMetricFaded = selectedMetric !== 'all' && selectedMetric !== metric;

                return (
                    <Segment
                        key={metric}
                        position={[0, yPos, 0]}
                        scale={[0.4, height, 0.4]}
                        color={METRIC_COLORS[metric]}
                        delay={idx * 0.15}
                        isHovered={isHovered}
                        isPulsing={isPulsing}
                        isFaded={isMetricFaded}
                    />
                );
            })}

            {/* Label */}
            <Html position={[0, -0.3, 0]} center>
                <div
                    style={{
                        color: '#1e293b',
                        fontWeight: '600',
                        fontSize: '11px',
                        whiteSpace: 'nowrap',
                        userSelect: 'none',
                        opacity: isFaded ? 0.5 : 1,
                    }}
                >
                    {eventType}
                </div>
            </Html>

            {/* Hover Tooltip */}
            {isHovered && (
                <Html position={[0, currentY + 0.5, 0]} center>
                    <div
                        style={{
                            background: 'rgba(15, 23, 42, 0.95)',
                            color: '#fff',
                            padding: '12px 16px',
                            borderRadius: '8px',
                            fontSize: '11px',
                            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                            minWidth: '180px',
                        }}
                    >
                        <div style={{ fontWeight: '700', marginBottom: '8px', fontSize: '12px' }}>
                            {eventType}
                        </div>
                        {metrics.map((metric) => (
                            <div
                                key={metric}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    marginBottom: '4px',
                                }}
                            >
                                <div
                                    style={{
                                        width: '8px',
                                        height: '8px',
                                        borderRadius: '50%',
                                        background: METRIC_COLORS[metric],
                                    }}
                                />
                                <span style={{ opacity: 0.8 }}>{METRIC_LABELS[metric]}:</span>
                                <span style={{ fontWeight: '600', marginLeft: 'auto' }}>
                                    {rawData[metric]}{METRIC_UNITS[metric]}
                                </span>
                            </div>
                        ))}
                    </div>
                </Html>
            )}
        </group>
    );
}

function Scene({
    normalizedData,
    hoveredTower,
    onHover,
    selectedMetric,
    focusedEvent,
}: {
    normalizedData: Record<string, Record<MetricKey, number>>;
    hoveredTower: EventType | null;
    onHover: (type: EventType | null) => void;
    selectedMetric: MetricKey | 'all';
    focusedEvent: EventType | null;
}) {
    const bgColor = useMemo(() => {
        if (focusedEvent === 'Mix') return new THREE.Color('#1e3a8a'); // Blue-purple
        if (focusedEvent === 'Heavy Rain') return new THREE.Color('#0f172a'); // Dark blue
        if (focusedEvent === 'Normal') return new THREE.Color('#334155'); // Grey-blue
        return new THREE.Color('#1e293b');
    }, [focusedEvent]);

    return (
        <>
            <color attach="background" args={[bgColor]} />

            {/* Lights */}
            <ambientLight intensity={0.4} />
            <directionalLight position={[5, 8, 5]} intensity={0.8} castShadow />
            <pointLight position={[-5, 5, -5]} intensity={0.3} />

            {/* Gradient background plane */}
            <mesh position={[0, 1.5, -3]} rotation={[0, 0, 0]}>
                <planeGeometry args={[12, 6]} />
                <meshBasicMaterial color="#0f172a" transparent opacity={0.3} />
            </mesh>

            {/* Towers */}
            {STORM_STATS.map((stat, idx) => (
                <Tower
                    key={stat.type}
                    eventType={stat.type as EventType}
                    normalizedData={normalizedData[stat.type]}
                    rawData={stat}
                    xPosition={(idx - 1) * 1.2}
                    hoveredTower={hoveredTower}
                    onHover={onHover}
                    selectedMetric={selectedMetric}
                    focusedEvent={focusedEvent}
                />
            ))}

            {/* Grid */}
            <gridHelper args={[8, 16, '#475569', '#334155']} position={[0, -0.01, 0]} />
        </>
    );
}

// ========== MAIN COMPONENT ==========
export default function StormSignatures3D() {
    const [hoveredTower, setHoveredTower] = useState<EventType | null>(null);
    const [selectedMetric, setSelectedMetric] = useState<MetricKey | 'all'>('all');
    const [focusedEvent, setFocusedEvent] = useState<EventType | null>(null);

    const normalizedData = useMemo(() => normalizeMetrics(STORM_STATS), []);

    const metrics: Array<{ key: MetricKey | 'all'; label: string }> = [
        { key: 'all', label: 'All' },
        { key: 'temp', label: 'Temp' },
        { key: 'humidity', label: 'Humidity' },
        { key: 'pressure', label: 'Pressure' },
        { key: 'wind', label: 'Wind' },
    ];

    const eventTypes: EventType[] = ['Mix', 'Heavy Rain', 'Normal'];

    return (
        <div
            style={{
                background: '#ffffff',
                borderRadius: '20px',
                padding: '24px',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
                marginBottom: '32px',
            }}
        >
            {/* Header */}
            <div style={{ marginBottom: '20px' }}>
                <h3
                    style={{
                        fontSize: '18px',
                        fontWeight: '600',
                        color: '#0f172a',
                        margin: '0 0 6px 0',
                    }}
                >
                    Storm Signatures — 1 h before event
                </h3>
                <p
                    style={{
                        fontSize: '13px',
                        color: '#64748b',
                        margin: 0,
                    }}
                >
                    3D comparison of Mix, Heavy Rain and Normal events (temperature, humidity, pressure, wind)
                </p>
            </div>

            {/* Metric Filter Chips */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                {metrics.map(({ key, label }) => (
                    <button
                        key={key}
                        onClick={() => setSelectedMetric(key)}
                        style={{
                            padding: '6px 14px',
                            borderRadius: '6px',
                            border: selectedMetric === key ? 'none' : '1px solid #e2e8f0',
                            background: selectedMetric === key ? METRIC_COLORS[key as MetricKey] || '#3b82f6' : '#f8fafc',
                            color: selectedMetric === key ? '#fff' : '#64748b',
                            fontSize: '12px',
                            fontWeight: '500',
                            cursor: 'pointer',
                            transition: 'all 150ms ease',
                        }}
                    >
                        {label}
                    </button>
                ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
                {/* Canvas */}
                <div style={{ height: '400px', borderRadius: '12px', overflow: 'hidden', background: '#0f172a' }}>
                    <Canvas camera={{ position: [0, 2.5, 4], fov: 45 }}>
                        <Scene
                            normalizedData={normalizedData}
                            hoveredTower={hoveredTower}
                            onHover={setHoveredTower}
                            selectedMetric={selectedMetric}
                            focusedEvent={focusedEvent}
                        />
                        <OrbitControls
                            enableZoom={false}
                            enablePan={false}
                            minPolarAngle={Math.PI / 4}
                            maxPolarAngle={Math.PI / 2.5}
                        />
                    </Canvas>
                </div>

                {/* Legend & Controls */}
                <div>
                    {/* Event Focus Control */}
                    <div style={{ marginBottom: '20px' }}>
                        <div
                            style={{
                                fontSize: '11px',
                                fontWeight: '600',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                                color: '#64748b',
                                marginBottom: '8px',
                            }}
                        >
                            Focus Event
                        </div>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {eventTypes.map((type) => (
                                <button
                                    key={type}
                                    onClick={() => setFocusedEvent(focusedEvent === type ? null : type)}
                                    style={{
                                        padding: '6px 12px',
                                        borderRadius: '6px',
                                        border: focusedEvent === type ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                                        background: focusedEvent === type ? '#eff6ff' : '#fff',
                                        color: focusedEvent === type ? '#2563eb' : '#64748b',
                                        fontSize: '11px',
                                        fontWeight: '500',
                                        cursor: 'pointer',
                                        transition: 'all 150ms ease',
                                    }}
                                >
                                    {type}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Legend */}
                    <div>
                        <div
                            style={{
                                fontSize: '11px',
                                fontWeight: '600',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                                color: '#64748b',
                                marginBottom: '12px',
                            }}
                        >
                            Metrics
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {(Object.keys(METRIC_COLORS) as MetricKey[]).map((metric) => (
                                <div key={metric}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                        <div
                                            style={{
                                                width: '12px',
                                                height: '12px',
                                                borderRadius: '3px',
                                                background: METRIC_COLORS[metric],
                                            }}
                                        />
                                        <span style={{ fontSize: '12px', fontWeight: '600', color: '#1e293b' }}>
                                            {METRIC_LABELS[metric]}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#64748b', paddingLeft: '20px' }}>
                                        {STORM_STATS.map((stat) => (
                                            <div key={stat.type} style={{ marginBottom: '2px' }}>
                                                {stat.type}: <strong>{stat[metric]}{METRIC_UNITS[metric]}</strong>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
