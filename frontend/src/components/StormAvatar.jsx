import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Cloud, RoundedBox, Float, Ring } from '@react-three/drei';
import * as THREE from 'three';

// Lerp helper
const lerp = THREE.MathUtils.lerp;
const colorLerp = (current, target, factor) => {
    const c1 = new THREE.Color(current);
    const c2 = new THREE.Color(target);
    c1.lerp(c2, factor);
    return c1.getStyle();
};

function Particles({ count, type, targetSpeed, targetColor, size }) {
    const mesh = useRef();
    const dummy = useMemo(() => new THREE.Object3D(), []);

    // Persistent state for interpolation
    const currentSpeed = useRef(targetSpeed);

    // Generate max particles (pool)
    const maxParticles = 500;
    const particles = useMemo(() => {
        const temp = [];
        for (let i = 0; i < maxParticles; i++) {
            const t = Math.random() * 100;
            const speedFactor = 0.01 + Math.random() / 200;
            const x = (Math.random() - 0.5) * 4.5;
            const y = (Math.random() - 0.5) * 4 + 2;
            const z = (Math.random() - 0.5) * 4.5;
            temp.push({ t, speedFactor, x, y, z, mx: 0, my: 0 });
        }
        return temp;
    }, []);

    useFrame((state, delta) => {
        // Smoothly interpolate speed
        currentSpeed.current = lerp(currentSpeed.current, targetSpeed, delta * 2);

        particles.forEach((particle, i) => {
            // Only render up to 'count' particles
            if (i >= count) {
                dummy.position.set(0, -100, 0); // Hide
                dummy.updateMatrix();
                mesh.current.setMatrixAt(i, dummy.matrix);
                return;
            }

            let { t, speedFactor } = particle;
            t = particle.t += speedFactor / 2;

            // Fall down
            particle.my -= currentSpeed.current * delta;

            // Reset if too low
            if (particle.y + particle.my < 0) {
                particle.my = 4;
                particle.x = (Math.random() - 0.5) * 4.5;
                particle.z = (Math.random() - 0.5) * 4.5;
            }

            // Drifting
            if (type === 'snow') {
                particle.mx += (Math.random() - 0.5) * 0.02;
            }

            dummy.position.set(
                particle.x + particle.mx + (type === 'snow' ? Math.sin(t * 5) * 0.2 : 0),
                particle.y + particle.my,
                particle.z + (type === 'snow' ? Math.cos(t * 5) * 0.2 : 0)
            );

            const s = Math.cos(t);
            // Rain is stretched, Snow is uniform
            const scale = type === 'rain' ? [0.03, 0.5, 0.03] : [size, size, size];
            dummy.scale.set(...scale);
            dummy.rotation.set(s, s, s);
            dummy.updateMatrix();
            mesh.current.setMatrixAt(i, dummy.matrix);
        });
        mesh.current.instanceMatrix.needsUpdate = true;

        // Color interpolation could be done here if material ref was exposed, 
        // but for simplicity we let React handle material prop updates which are fast enough.
    });

    return (
        <instancedMesh ref={mesh} args={[null, null, maxParticles]}>
            {type === 'rain' ? <boxGeometry /> : <dodecahedronGeometry args={[0.1, 0]} />}
            <meshStandardMaterial color={targetColor} transparent opacity={0.8} roughness={0.1} />
        </instancedMesh>
    );
}

function InterpolatedScene({ config, type }) {
    // Refs for values we want to lerp
    const cloudRef = useRef();
    const ringRef = useRef();
    const lightRef = useRef();
    const freezingLineMaterialRef = useRef();

    // Current values
    const values = useRef({
        cloudOpacity: config.cloudOpacity,
        cloudY: 3.5,
        ringScale: config.ringScale,
        ringOpacity: 0.6,
        freezingLineY: config.freezingLineY,
        freezingLineColor: new THREE.Color(config.freezingLineColor)
    });

    useFrame((state, delta) => {
        const dt = delta * 2; // Interpolation speed

        // Lerp values
        values.current.cloudOpacity = lerp(values.current.cloudOpacity, config.cloudOpacity, dt);
        values.current.ringScale = lerp(values.current.ringScale, config.ringScale, dt);
        values.current.freezingLineY = lerp(values.current.freezingLineY, config.freezingLineY, dt);
        values.current.freezingLineColor.lerp(new THREE.Color(config.freezingLineColor), dt);

        // Apply to objects
        if (cloudRef.current) {
            // Cloud doesn't expose opacity directly in a simple way on the group, 
            // but we can try to scale it or move it to simulate "heaviness"
            // Let's move it lower for heavy pressure
            const targetY = config.isHeavy ? 3.0 : 3.8;
            values.current.cloudY = lerp(values.current.cloudY, targetY, dt);
            cloudRef.current.position.y = values.current.cloudY;
        }

        if (ringRef.current) {
            ringRef.current.scale.setScalar(values.current.ringScale);
        }

        if (freezingLineMaterialRef.current) {
            freezingLineMaterialRef.current.color.copy(values.current.freezingLineColor);
        }
    });

    return (
        <group>
            {/* 1. Platform */}
            <RoundedBox args={[5, 0.2, 5]} radius={0.1} smoothness={4} position={[0, 0, 0]}>
                <meshStandardMaterial color="#f8fafc" roughness={0.2} metalness={0.1} />
            </RoundedBox>

            {/* 2. Detection Ring */}
            <group position={[0, -0.2, 0]} ref={ringRef}>
                <Ring args={[2.8, 2.9, 64]} rotation={[-Math.PI / 2, 0, 0]}>
                    <meshBasicMaterial color={config.ringColor} transparent opacity={0.6} side={THREE.DoubleSide} />
                </Ring>
                <pointLight position={[0, 1, 0]} color={config.ringColor} intensity={1} distance={5} />
            </group>

            {/* 3. Freezing Line */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, values.current.freezingLineY, 0]}>
                <planeGeometry args={[4.5, 4.5]} />
                <meshBasicMaterial
                    ref={freezingLineMaterialRef}
                    color={values.current.freezingLineColor}
                    transparent
                    opacity={0.05}
                    side={THREE.DoubleSide}
                />
            </mesh>

            {/* 4. Particles */}
            <group position={[0, 0, 0]}>
                <Particles
                    count={config.particleCount}
                    type={type}
                    targetSpeed={config.particleSpeed}
                    targetColor={config.particleColor}
                    size={config.particleSize}
                />
            </group>

            {/* 5. Cloud */}
            <group ref={cloudRef} position={[0, 3.5, 0]}>
                <Cloud
                    opacity={config.cloudOpacity}
                    speed={0.2}
                    width={6}
                    depth={1}
                    segments={config.isHeavy ? 25 : 15} // More segments for heavy
                    color={config.cloudColor}
                />
            </group>

            {/* Lighting */}
            <ambientLight intensity={0.6} />
            <directionalLight position={[5, 10, 5]} intensity={1.5} castShadow />
            <pointLight position={[-5, 2, -5]} intensity={0.5} color="#bae6fd" />
        </group>
    );
}

export default function StormAvatar({ type, isHeavy, data }) {
    // Configuration based on type and intensity
    const config = useMemo(() => {
        const c = {
            isHeavy,
            particleCount: 80,
            particleSpeed: 2,
            particleColor: '#ffffff',
            particleSize: 0.12,
            cloudOpacity: 0.5,
            cloudColor: '#e2e8f0', // Slate-200
            ringColor: '#3b82f6', // Blue-500
            ringScale: 1,
            freezingLineY: 1.5,
            freezingLineColor: '#3b82f6'
        };

        if (isHeavy) {
            c.particleCount = 350; // Much more for heavy
            c.cloudOpacity = 0.9;
            c.cloudColor = '#64748b'; // Slate-500 (Darker)
            c.ringColor = '#f59e0b'; // Amber-500
            c.ringScale = 1.3;
        }

        if (type === 'rain') {
            c.particleSpeed = isHeavy ? 15 : 8;
            c.particleColor = '#60a5fa';
            c.freezingLineY = 4;
            c.freezingLineColor = '#ef4444'; // Red/Warm
        } else if (type === 'snow') {
            c.particleSpeed = isHeavy ? 1.5 : 0.8;
            c.particleColor = '#ffffff';
            c.freezingLineY = 0.5;
            c.freezingLineColor = '#3b82f6'; // Blue/Cold
        } else if (type === 'mix') {
            c.particleSpeed = isHeavy ? 8 : 4;
            c.particleColor = '#c084fc';
            c.freezingLineY = 2;
            c.freezingLineColor = '#a855f7'; // Purple
        }

        // Map temp to freezing line visual if data exists
        if (data?.tempC !== undefined) {
            // -5C -> 0.5Y, +15C -> 4.5Y
            c.freezingLineY = Math.max(0.5, Math.min(4.5, (data.tempC + 5) / 5 + 0.5));
            c.freezingLineColor = data.tempC > 0 ? '#ef4444' : '#3b82f6';
        }

        return c;
    }, [type, isHeavy, data]);

    return (
        <group position={[0, -1.5, 0]}>
            <Float speed={2} rotationIntensity={0.2} floatIntensity={0.5}>
                <InterpolatedScene config={config} type={type} />
            </Float>
        </group>
    );
}
