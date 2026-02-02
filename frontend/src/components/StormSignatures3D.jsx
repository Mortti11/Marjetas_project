import React, { useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, Grid, Html } from '@react-three/drei';
import * as THREE from 'three';

// --- Bar Component ---
function Bar({ position, color, height, label, eventData, isFocused, isDimmed, onHover, onOut, onClick, showValue, value }) {
    const meshRef = useRef();
    const [hovered, setHovered] = useState(false);

    // Smooth animation for height and color
    useFrame((state, delta) => {
        if (meshRef.current) {
            // Animate height
            meshRef.current.position.y = THREE.MathUtils.lerp(meshRef.current.position.y, height / 2, delta * 4);
            meshRef.current.scale.y = THREE.MathUtils.lerp(meshRef.current.scale.y, height, delta * 4);

            // Animate hover scale effect (width/depth)
            const targetScale = hovered || isFocused ? 1.15 : 1.0;
            meshRef.current.scale.x = THREE.MathUtils.lerp(meshRef.current.scale.x, targetScale, delta * 8);
            meshRef.current.scale.z = THREE.MathUtils.lerp(meshRef.current.scale.z, targetScale, delta * 8);
        }
    });

    const finalColor = isDimmed ? '#cbd5e1' : color;
    const opacity = isDimmed ? 0.3 : 1;
    const emissiveIntensity = isFocused || hovered ? 0.5 : 0;

    return (
        <group position={[position[0], 0, position[2]]}>
            <mesh
                ref={meshRef}
                position={[0, height / 2, 0]}
                onPointerOver={(e) => {
                    e.stopPropagation();
                    setHovered(true);
                    onHover();
                }}
                onPointerOut={(e) => {
                    setHovered(false);
                    onOut();
                }}
                onClick={(e) => {
                    e.stopPropagation();
                    onClick(eventData);
                }}
            >
                <boxGeometry args={[0.8, 1, 0.8]} />
                <meshStandardMaterial
                    color={finalColor}
                    emissive={finalColor}
                    emissiveIntensity={emissiveIntensity}
                    roughness={0.3}
                    metalness={0.1}
                    transparent={isDimmed}
                    opacity={opacity}
                />
            </mesh>

            {/* Label below bar */}
            <Text
                position={[0, -0.2, 0.6]}
                rotation={[-Math.PI / 2, 0, 0]}
                fontSize={0.25}
                color={isDimmed ? "#94a3b8" : "#64748b"}
                anchorX="center"
                anchorY="middle"
            >
                {label}
            </Text>

            {/* Value label above bar (when not dimmed) */}
            {showValue && !isDimmed && (
                <Text
                    position={[0, height + 0.3, 0]}
                    fontSize={0.22}
                    color="#1e293b"
                    anchorX="center"
                    anchorY="middle"
                    font="bold"
                >
                    {value}
                </Text>
            )}

            {/* Tooltip on hover */}
            {hovered && (
                <Html position={[0, height + 0.6, 0]} center>
                    <div className="bg-slate-900 text-white px-3 py-2 rounded-lg shadow-lg text-xs whitespace-nowrap pointer-events-none">
                        <div className="font-bold">{eventData.label}</div>
                        <div className="text-slate-300">{value}</div>
                    </div>
                </Html>
            )}
        </group>
    );
}

// --- Main Scene Component ---
function Scene({ data, selectedMetric, selectedFamily, onFocus, focusedEvent, onSelectEvent }) {
    // Calculate bar heights and values
    const getBarData = (family, intensity) => {
        const d = data[family][intensity];
        if (!d) return { height: 0, value: '—' };

        const base = 0.5;

        if (selectedMetric === 'temperature') {
            const height = base + ((d.tempC + 5) / 20) * 3;
            const value = `${d.tempC > 0 ? '+' : ''}${d.tempC}°C`;
            return { height, value };
        } else if (selectedMetric === 'pressure') {
            if (family === 'mix') {
                const height = base + (d.pressureDeltaHpa || 0) * 0.8;
                const value = `${d.pressureDeltaHpa > 0 ? '+' : ''}${d.pressureDeltaHpa} hPa`;
                return { height, value };
            }
            const p = d.pressureHpa || 1000;
            const height = base + ((1000 - p) / 30) * 4;
            const value = `${p} hPa`;
            return { height, value };
        } else {
            // Detection
            const height = intensity === 'heavy' ? 3.5 : 1.5;
            const value = intensity === 'heavy' ? '24+ h' : '12-24 h';
            return { height, value };
        }
    };

    const families = ['snow', 'mix', 'rain'];
    const intensities = ['normal', 'heavy'];

    // Cluster configuration
    const clusterSpacing = 4;
    const barSpacing = 1.0;

    return (
        <>
            <ambientLight intensity={0.7} />
            <directionalLight position={[5, 10, 5]} intensity={1.2} castShadow />
            <pointLight position={[-5, 5, -5]} intensity={0.5} color="#60a5fa" />

            <Grid
                position={[0, -0.01, 0]}
                args={[30, 20]}
                cellSize={1}
                cellThickness={0.5}
                cellColor="#1e3a5f"
                sectionSize={5}
                sectionThickness={1}
                sectionColor="#2563eb"
                fadeDistance={25}
                fadeStrength={1}
            />

            <group position={[0, 0, 0]}>
                {families.map((family, fIdx) => {
                    // Calculate cluster center X
                    const clusterX = (fIdx - 1) * clusterSpacing; // -4, 0, 4

                    return (
                        <group key={family}>
                            {intensities.map((intensity, iIdx) => {
                                const isDimmed = selectedFamily !== 'all' && selectedFamily !== family;
                                const isFocused = focusedEvent?.family === family && focusedEvent?.intensity === intensity;
                                const item = data[family][intensity];
                                const { height, value } = getBarData(family, intensity);

                                // Position bars side-by-side within cluster
                                const barX = clusterX + (iIdx === 0 ? -barSpacing / 2 : barSpacing / 2);

                                return (
                                    <Bar
                                        key={`${family}-${intensity}`}
                                        position={[barX, 0, 0]}
                                        color={item.color}
                                        height={height}
                                        label={intensity === 'heavy' ? 'Heavy' : 'Normal'}
                                        eventData={{ family, intensity, label: item.label }}
                                        isFocused={isFocused}
                                        isDimmed={isDimmed}
                                        onHover={() => onFocus({ family, intensity })}
                                        onOut={() => onFocus(null)}
                                        onClick={onSelectEvent}
                                        showValue={true}
                                        value={value}
                                    />
                                );
                            })}

                            {/* Cluster Label */}
                            <Text
                                position={[clusterX, 0, 2.5]}
                                rotation={[-Math.PI / 2, 0, 0]}
                                fontSize={0.5}
                                fontWeight="bold"
                                color="#f1f5f9"
                                anchorX="center"
                                anchorY="middle"
                            >
                                {family.toUpperCase()}
                            </Text>
                        </group>
                    );
                })}
            </group>

            <OrbitControls
                enableZoom={false}
                enablePan={true}
                minPolarAngle={Math.PI / 4}
                maxPolarAngle={Math.PI / 2.5}
                autoRotate={false}
                target={[0, 1, 0]}
            />
        </>
    );
}

export default function StormSignatures3D({ data, selectedMetric, selectedFamily, onFocus, focusedEvent, onSelectEvent }) {
    if (!data) return null;

    return (
        <Canvas camera={{ position: [0, 5, 12], fov: 45 }}>
            <color attach="background" args={['#0f172a']} /> {/* Dark blue */}
            <fog attach="fog" args={['#0f172a', 10, 25]} />
            <Scene
                data={data}
                selectedMetric={selectedMetric}
                selectedFamily={selectedFamily}
                onFocus={onFocus}
                focusedEvent={focusedEvent}
                onSelectEvent={onSelectEvent}
            />
        </Canvas>
    );
}
