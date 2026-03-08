import { RigidBody, CuboidCollider } from '@react-three/rapier'
import { useMemo } from 'react'
import { RepeatWrapping, TextureLoader, CanvasTexture } from 'three'

function useGridTexture() {
  return useMemo(() => {
    const size = 128
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#588157'
    ctx.fillRect(0, 0, size, size)
    ctx.strokeStyle = '#4a7049'
    ctx.lineWidth = 2
    ctx.strokeRect(0, 0, size, size)
    ctx.strokeStyle = '#6a9b5a'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(size / 2, 0)
    ctx.lineTo(size / 2, size)
    ctx.moveTo(0, size / 2)
    ctx.lineTo(size, size / 2)
    ctx.stroke()
    const tex = new CanvasTexture(canvas)
    tex.wrapS = tex.wrapT = RepeatWrapping
    tex.repeat.set(60, 60)
    return tex
  }, [])
}

function Ramp({ position, rotation }: { position: [number, number, number]; rotation?: [number, number, number] }) {
  return (
    <RigidBody type="fixed" position={position} rotation={rotation || [0, 0, 0]}>
      <mesh receiveShadow castShadow>
        <boxGeometry args={[6, 0.3, 8]} />
        <meshStandardMaterial color="#d4a373" />
      </mesh>
    </RigidBody>
  )
}

function Bridge() {
  const segments = useMemo(() => {
    const segs: { pos: [number, number, number]; rot: [number, number, number]; len: number }[] = []
    const width = 8
    const count = 24
    const bridgeLen = 80
    const peakHeight = 15
    const startZ = -15

    for (let i = 0; i < count; i++) {
      const t0 = i / count
      const t1 = (i + 1) / count

      // Parabolic arc: y = 4*h*t*(1-t)
      const z0 = startZ - t0 * bridgeLen
      const z1 = startZ - t1 * bridgeLen
      const y0 = 4 * peakHeight * t0 * (1 - t0)
      const y1 = 4 * peakHeight * t1 * (1 - t1)

      const midZ = (z0 + z1) / 2
      const midY = (y0 + y1) / 2
      const dz = z1 - z0
      const dy = y1 - y0
      const segLen = Math.sqrt(dz * dz + dy * dy)
      const angle = Math.atan2(dy, -dz) // negative Z is forward

      segs.push({
        pos: [0, midY, midZ],
        rot: [angle, 0, 0],
        len: segLen + 0.1, // slight overlap to avoid gaps
      })
    }
    return segs
  }, [])

  return (
    <group>
      {segments.map((seg, i) => (
        <RigidBody key={`b-${i}`} type="fixed" position={seg.pos} rotation={seg.rot} friction={0.6}>
          <mesh receiveShadow castShadow>
            <boxGeometry args={[8, 0.4, seg.len]} />
            <meshStandardMaterial color="#8B7355" />
          </mesh>
        </RigidBody>
      ))}
      {/* Side rails */}
      {segments.map((seg, i) =>
        [-3.8, 3.8].map((xOff, j) => (
          <RigidBody key={`rail-${i}-${j}`} type="fixed"
            position={[xOff, seg.pos[1] + 0.8, seg.pos[2]]}
            rotation={seg.rot} friction={0.3}
          >
            <mesh castShadow>
              <boxGeometry args={[0.3, 1.2, seg.len]} />
              <meshStandardMaterial color="#666" />
            </mesh>
          </RigidBody>
        ))
      )}
    </group>
  )
}

export function FreePlayTerrain() {
  const ramps = useMemo(
    () => [
      { position: [20, 1, -30] as [number, number, number], rotation: [-0.2, 0, 0] as [number, number, number] },
      { position: [-15, 1.5, -60] as [number, number, number], rotation: [-0.25, 0.5, 0] as [number, number, number] },
      { position: [10, 2, -100] as [number, number, number], rotation: [-0.3, -0.3, 0] as [number, number, number] },
    ],
    [],
  )

  const gridTex = useGridTexture()

  return (
    <>
      {/* Ground */}
      <RigidBody type="fixed" friction={0.5} restitution={0}>
        <CuboidCollider args={[150, 0.1, 150]} position={[0, -0.1, 0]} />
        <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
          <planeGeometry args={[300, 300]} />
          <meshStandardMaterial map={gridTex} />
        </mesh>
      </RigidBody>

      {/* Ramps */}
      {ramps.map((r, i) => (
        <Ramp key={i} position={r.position} rotation={r.rotation} />
      ))}

      {/* Curved bridge */}
      <Bridge />
    </>
  )
}
