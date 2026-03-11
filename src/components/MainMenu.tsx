import { Canvas, useFrame } from '@react-three/fiber'
import { useRef, useState } from 'react'
import { useGLTF } from '@react-three/drei'
import { CylinderGeometry, type Group } from 'three'
import { useGameStore, type VehicleType } from '../hooks/useGameStore'

const VEHICLES: { type: VehicleType; label: string; emoji: string }[] = [
  { type: 'car', label: 'Family Car', emoji: '🚗' },
  { type: 'ball', label: 'Ball', emoji: '⚽' },
  { type: 'base', label: 'Basic', emoji: '🚗' },
]

const WHEEL_POSITIONS = [
  { x: -1.3, y: -0.5, z: -1.5 },
  { x: 1.3, y: -0.5, z: -1.5 },
  { x: -1.3, y: -0.5, z: 1.5 },
  { x: 1.3, y: -0.5, z: 1.5 },
]

function RotatingPreview({ vehicleType }: { vehicleType: VehicleType }) {
  const groupRef = useRef<Group>(null)
  const { scene } = useGLTF('/cars/family-car.glb')

  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.4
  })

  if (vehicleType === 'ball') {
    return (
      <group ref={groupRef} position={[0, 0, 0]}>
        <mesh>
          <sphereGeometry args={[1, 32, 32]} />
          <meshStandardMaterial color="#ff6b35" metalness={0.4} roughness={0.3} />
        </mesh>
      </group>
    )
  }

  if (vehicleType === 'base') {
    return (
      <group ref={groupRef} position={[0, 0, 0]} scale={0.5}>
        <mesh>
          <mesh position={[0, -0.3, 0]}>
            <boxGeometry args={[2.8, 1, 4]} />
            <meshStandardMaterial color="crimson" />
          </mesh>
          {WHEEL_POSITIONS.map((wheelPos, i) => (
            <group
              key={i}
              position={[wheelPos.x, wheelPos.y - 0.4, wheelPos.z]}
            >
              <lineSegments rotation={[0, 0, Math.PI / 2]}>
                <edgesGeometry args={[new CylinderGeometry(0.8, 0.8, 0.3, 16)]} />
                <lineBasicMaterial color="white" />
              </lineSegments>
            </group>
          ))}
        </mesh>
      </group>
    )
  }

  return (
    <group ref={groupRef} position={[0, -0.3, 0]}>
      <primitive object={scene.clone()} scale={0.5} rotation={[0, Math.PI, 0]} />
    </group>
  )
}

const btnBase: React.CSSProperties = {
  pointerEvents: 'auto',
  padding: '16px 48px',
  fontSize: 'clamp(1rem, 3vw, 1.5rem)',
  fontFamily: 'monospace',
  fontWeight: 'bold',
  color: '#fff',
  border: '2px solid #e63946',
  borderRadius: 8,
  cursor: 'pointer',
  transition: 'all 0.2s',
  textTransform: 'uppercase',
  letterSpacing: '0.15em',
}

function MenuButton({ label, onClick, style }: { label: string; onClick: () => void; style?: React.CSSProperties }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      style={{
        ...btnBase,
        background: hovered ? '#e63946' : 'rgba(230,57,70,0.3)',
        ...style,
      }}
    >
      {label}
    </button>
  )
}

export function MainMenu({ onStart, onFreePlay }: { onStart: () => void; onFreePlay: () => void }) {
  const { vehicleType, setVehicleType } = useGameStore()

  const cycleVehicle = (dir: number) => {
    const idx = VEHICLES.findIndex((v) => v.type === vehicleType)
    const next = (idx + dir + VEHICLES.length) % VEHICLES.length
    setVehicleType(VEHICLES[next].type)
  }

  const current = VEHICLES.find((v) => v.type === vehicleType)!

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Canvas camera={{ position: [0, 3, 8], fov: 45 }}>
        <color attach="background" args={['#0a0a1a']} />
        <ambientLight intensity={0.3} />
        <directionalLight position={[5, 5, 5]} intensity={1} />
        <fog attach="fog" args={['#0a0a1a', 10, 20]} />
        <RotatingPreview vehicleType={vehicleType} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]}>
          <planeGeometry args={[50, 50]} />
          <meshStandardMaterial color="#1a1a2e" />
        </mesh>
      </Canvas>

      <div
        style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <h1
          style={{
            color: '#fff', fontFamily: 'monospace',
            fontSize: 'clamp(2rem, 6vw, 4rem)',
            textShadow: '0 0 20px rgba(230,57,70,0.8)',
            marginBottom: '0.5em', letterSpacing: '0.1em',
          }}
        >
          NO MAN'S LAND
        </h1>

        {/* Vehicle selector */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 16,
          marginBottom: 24, pointerEvents: 'auto',
        }}>
          <button onClick={() => cycleVehicle(-1)} style={{
            ...btnBase, padding: '10px 18px', border: '2px solid rgba(255,255,255,0.3)',
            fontSize: 'clamp(1.2rem, 3vw, 1.8rem)',
          }}>
            ◀
          </button>
          <div style={{
            color: '#fff', fontFamily: 'monospace', textAlign: 'center',
            minWidth: 160,
          }}>
            <div style={{ fontSize: 'clamp(2rem, 5vw, 3rem)' }}>{current.emoji}</div>
            <div style={{
              fontSize: 'clamp(0.9rem, 2.5vw, 1.2rem)',
              letterSpacing: '0.1em', textTransform: 'uppercase',
            }}>
              {current.label}
            </div>
          </div>
          <button onClick={() => cycleVehicle(1)} style={{
            ...btnBase, padding: '10px 18px', border: '2px solid rgba(255,255,255,0.3)',
            fontSize: 'clamp(1.2rem, 3vw, 1.8rem)',
          }}>
            ▶
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <MenuButton label="Start" onClick={onStart} />
          <MenuButton label="Free Play" onClick={onFreePlay} />
        </div>

        <p
          style={{
            color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace',
            fontSize: 'clamp(0.7rem, 2vw, 0.9rem)', marginTop: '2em',
          }}
        >
          WASD / Arrows / Touch to drive
        </p>
      </div>
    </div>
  )
}

useGLTF.preload('/cars/family-car.glb')
