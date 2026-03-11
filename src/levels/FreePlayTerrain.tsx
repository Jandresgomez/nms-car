import { RigidBody, CuboidCollider } from '@react-three/rapier'
import { useMemo } from 'react'
import { RepeatWrapping, CanvasTexture } from 'three'
import { Straight, LCurve, RCurve, RampUp, RampDown, TILE } from '../track-parts'
import { useGameStore } from '../hooks/useGameStore'
import { Coin } from '../components/Coin'

/** Shorthand aliases – every position is now a multiple of tile dimensions */
const S = TILE.straightLength  // straight piece spacing along Z
const C = TILE.curveSize       // curve bounding box (square)
const R = TILE.rampLength     // ramp length along Z
const RH = TILE.rampHeight     // ramp peak height

function coinGrid(
  center: [number, number, number],
  size: number,
  spacing: number = 2
): [number, number, number][] {
  const positions: [number, number, number][] = []
  const offset = ((size - 1) * spacing) / 2
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      positions.push([
        center[0] + col * spacing - offset,
        center[1],
        center[2] + row * spacing - offset,
      ])
    }
  }
  return positions
}

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

export function FreePlayTerrain() {
  const gridTex = useGridTexture()
  const debug = useGameStore((s) => s.debug)

  // Precompute key Y / Z anchors from tile dimensions
  const rampStartZ = -5.5 * S          // Z where ramp begins (after 6 straights)
  const rampEndZ = rampStartZ - R    // Z where ramp ends (elevated section starts)
  const elevY = RH                   // elevated section Y

  // Elevated section: straight → RCurve → lateral straight → RCurve → LCurve → RCurve
  const elev0Z = rampEndZ - S        // first elevated straight
  const rc1Z = elev0Z - S            // first right curve
  const lateralX = C - S             // X offset after first curve exit
  const lateralZ = rc1Z - C + S      // Z of lateral straight (curve exit)
  const rc2X = lateralX + S          // second right curve X
  const lc1X = rc2X + C - S          // left curve X (flipped back)
  const lc1Z = lateralZ + C - S      // left curve Z
  const rc3X = lc1X + C - S          // third right curve X
  const rc3Z = lc1Z + C - S          // third right curve Z

  // Ramp down origin: continues from rc3 exit
  const rampDownX = rc3X + C - S
  const rampDownZ = rc3Z + R - S * 0.5         // ramp goes +Z (rotated 180°)

  // Return straights at ground level, same X as ramp down exit
  const returnX = rampDownX

  return (
    <>
      {/* Ground */}
      <RigidBody type="fixed" friction={0.5} restitution={0}>
        <CuboidCollider args={[250, 0.25, 250]} position={[0, -0.25, 0]} />
        <mesh receiveShadow position={[0, -0.25, 0]}>
          <boxGeometry args={[500, 0.5, 500]} />
          <meshStandardMaterial map={gridTex} transparent={debug} opacity={debug ? 0.25 : 1} />
        </mesh>
      </RigidBody>

      {/* === Track with coins === */}
      {coinGrid([0, 2, 50], 20).map((pos, i) => (
        <Coin key={i} position={pos} />
      ))}

      {/* Starting straights */}
      <Straight position={[0, 0, 0]} />
      <Straight position={[0, 0, -1 * S]} coins="center" />
      <Straight position={[0, 0, -2 * S]} coins="center" />
      <Straight position={[0, 0, -3 * S]} coins="left" />
      <Straight position={[0, 0, -4 * S]} coins="left" />
      <Straight position={[0, 0, -5 * S]} />

      {/* Ramp up */}
      <RampUp position={[0, 0, rampStartZ]} />

      {/* Elevated section */}
      <Straight position={[0, elevY, elev0Z]} />
      <RCurve position={[0, elevY, rc1Z]} coins="center" />
      <Straight position={[lateralX, elevY, lateralZ]} rotation={[0, Math.PI / 2, 0]} coins="center" />
      <RCurve position={[rc2X, elevY, lateralZ]} rotation={[0, -Math.PI / 2, 0]} coins="center" />
      <LCurve position={[lc1X, elevY, lc1Z]} rotation={[0, Math.PI, 0]} coins="center" />
      <RCurve position={[rc3X, elevY, rc3Z]} rotation={[0, -Math.PI / 2, 0]} coins="center" />

      {/* Ramp down */}
      <RampDown position={[rampDownX, elevY, rampDownZ]} rotation={[0, Math.PI, 0]} />

      {/* Return straights */}
      <Straight position={[returnX, 0, -3 * S]} rotation={[0, Math.PI, 0]} />
      <Straight position={[returnX, 0, -2 * S]} rotation={[0, Math.PI, 0]} />
      <Straight position={[returnX, 0, -1 * S]} rotation={[0, Math.PI, 0]} coins="center" />
      <Straight position={[returnX, 0, 0]} rotation={[0, Math.PI, 0]} coins="center" />
      <Straight position={[returnX, 0, 1 * S]} rotation={[0, Math.PI, 0]} coins="center" />
      <Straight position={[returnX, 0, 2 * S]} rotation={[0, Math.PI, 0]} coins="center" />
      <Straight position={[returnX, 0, 3 * S]} rotation={[0, Math.PI, 0]} />
    </>
  )
}
