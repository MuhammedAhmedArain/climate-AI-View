import { Canvas } from '@react-three/fiber';
import { OrbitControls, Sphere } from '@react-three/drei';
import { useRef } from 'react';
import * as THREE from 'three';

function Earth() {
  const earthRef = useRef<THREE.Mesh>(null);

  return (
    <Sphere ref={earthRef} args={[2.5, 64, 64]} rotation={[0, 0, 0]}>
      <meshStandardMaterial
        color="#1e88e5"
        roughness={0.7}
        metalness={0.2}
        emissive="#0d47a1"
        emissiveIntensity={0.2}
      />
    </Sphere>
  );
}

interface Earth3DBackgroundProps {
  opacity?: number;
  className?: string;
}

export default function Earth3DBackground({ opacity = 0.3, className = '' }: Earth3DBackgroundProps) {
  return (
    <div className={`fixed inset-0 -z-10 ${className}`} style={{ opacity }}>
      <Canvas camera={{ position: [0, 0, 8], fov: 45 }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <pointLight position={[-10, -10, -10]} intensity={0.5} color="#4fc3f7" />
        <Earth />
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          autoRotate
          autoRotateSpeed={0.5}
          minPolarAngle={Math.PI / 2.5}
          maxPolarAngle={Math.PI / 1.5}
        />
      </Canvas>
    </div>
  );
}