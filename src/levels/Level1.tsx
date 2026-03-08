import { RigidBody, CuboidCollider } from '@react-three/rapier'
import { useMemo } from 'react'
import { CanvasTexture, RepeatWrapping } from 'three'

function useTrackTexture() {
  return useMemo(() => {
    const size = 128
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#3a3a3a'
    ctx.fillRect(0, 0, size, size)
    // lane dashes
    ctx.strokeStyle = '#666'
    ctx.lineWidth = 2
    ctx.setLineDash([12, 12])
    ctx.beginPath()
    ctx.moveTo(size / 2, 0)
    ctx.lineTo(size / 2, size)
    ctx.stroke()
    const tex = new CanvasTexture(canvas)
    tex.wrapS = tex.wrapT = RepeatWrapping
    tex.repeat.set(2, 8)
    return tex
  }, [])
}

function TrackSegment({
  position,
  rotation = [0, 0, 0],
  size = [12, 0.3, 30],
}: {
  position: [number, number, number]
  rotation?: [number, number, number]
  size?: [number, number, number]
}) {
  const tex = useTrackTexture()
  return (
    <RigidBody type="fixed" position={position} rotation={rotation} friction={0.7}>
      <mesh receiveShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial map={tex} />
      </mesh>
    </RigidBody>
  )
}

function Wall({
  position,
  size = [0.5, 2, 30],
}: {
  position: [number, number, number]
  size?: [number, number, number]
}) {
  return (
    <RigidBody type="fixed" position={position}>
      <mesh castShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial color="#555" />
      </mesh>
    </RigidBody>
  )
}

function Coin({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh castShadow>
        <cylinderGeometry args={[0.6, 0.6, 0.15, 16]} />
        <meshStandardMaterial color="#ffd700" metalness={0.8} roughness={0.2} emissive="#ffa500" emissiveIntensity={0.3} />
      </mesh>
    </group>
  )
}

function Gate({ position, rotation = [0, 0, 0] }: { position: [number, number, number]; rotation?: [number, number, number] }) {
  return (
    <group position={position} rotation={rotation}>
      {/* Left post */}
      <mesh position={[-6, 2, 0]} castShadow>
        <boxGeometry args={[0.5, 4, 0.5]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      {/* Right post */}
      <mesh position={[6, 2, 0]} castShadow>
        <boxGeometry args={[0.5, 4, 0.5]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      {/* Banner */}
      <mesh position={[0, 4.2, 0]}>
        <boxGeometry args={[12.5, 1, 0.3]} />
        <meshStandardMaterial color="#e63946" emissive="#e63946" emissiveIntensity={0.3} />
      </mesh>
    </group>
  )
}

export function Level1() {
  // An oval-ish circuit: straight → right turn → straight back → right turn
  // Coins placed along the track
  const coins: [number, number, number][] = [
    [0, 1.2, -10],
    [0, 1.2, -25],
    [0, 1.2, -40],
    [0, 1.2, -55],
    // Turn 1 area
    [20, 1.2, -75],
    [40, 1.2, -75],
    // Return straight
    [60, 1.2, -55],
    [60, 1.2, -40],
    [60, 1.2, -25],
    [60, 1.2, -10],
    // Turn 2 area
    [40, 1.2, 5],
    [20, 1.2, 5],
  ]

  return (
    <>
      {/* Ground underneath */}
      <RigidBody type="fixed" friction={0.3}>
        <CuboidCollider args={[100, 0.1, 100]} position={[30, -0.5, -35]} />
        <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[30, -0.5, -35]}>
          <planeGeometry args={[200, 200]} />
          <meshStandardMaterial color="#2d5a27" />
        </mesh>
      </RigidBody>

      {/* === TRACK SEGMENTS === */}

      {/* Start/Finish straight (Z axis) */}
      <TrackSegment position={[0, 0, -35]} size={[12, 0.3, 80]} />
      {/* Walls for start straight */}
      <Wall position={[-6.25, 1, -35]} size={[0.5, 2, 80]} />
      <Wall position={[6.25, 1, -35]} size={[0.5, 2, 80]} />

      {/* Turn 1 (bottom, connecting to return straight) */}
      <TrackSegment position={[30, 0, -75]} size={[50, 0.3, 12]} rotation={[0, 0, 0]} />
      <Wall position={[30, 1, -81.25]} size={[50, 2, 0.5]} />
      <Wall position={[30, 1, -68.75]} size={[50, 2, 0.5]} />

      {/* Return straight */}
      <TrackSegment position={[60, 0, -35]} size={[12, 0.3, 80]} />
      <Wall position={[53.75, 1, -35]} size={[0.5, 2, 80]} />
      <Wall position={[66.25, 1, -35]} size={[0.5, 2, 80]} />

      {/* Turn 2 (top, connecting back to start) */}
      <TrackSegment position={[30, 0, 5]} size={[50, 0.3, 12]} rotation={[0, 0, 0]} />
      <Wall position={[30, 1, 11.25]} size={[50, 2, 0.5]} />
      <Wall position={[30, 1, -1.25]} size={[50, 2, 0.5]} />

      {/* Corner fillers (smooth the 90° turns) */}
      {/* Bottom-left corner */}
      <TrackSegment position={[0, 0, -75]} size={[12, 0.3, 12]} />
      {/* Bottom-right corner */}
      <TrackSegment position={[60, 0, -75]} size={[12, 0.3, 12]} />
      {/* Top-right corner */}
      <TrackSegment position={[60, 0, 5]} size={[12, 0.3, 12]} />
      {/* Top-left corner */}
      <TrackSegment position={[0, 0, 5]} size={[12, 0.3, 12]} />

      {/* === COINS === */}
      {coins.map((pos, i) => (
        <Coin key={i} position={pos} />
      ))}

      {/* === START/FINISH GATE === */}
      <Gate position={[0, 0, 2]} />
    </>
  )
}
