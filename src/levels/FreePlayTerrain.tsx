import { RigidBody, CuboidCollider } from '@react-three/rapier'
import { useMemo } from 'react'
import { RepeatWrapping, CanvasTexture } from 'three'
import { Straight, LCurve, RCurve, RampUp, RampDown } from '../track-parts'
import { useGameStore } from '../hooks/useGameStore'
import { Coin } from '../components/Coin'

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
      <Straight position={[0, 0, -10]} coins="center" />
      <Straight position={[0, 0, -20]} coins="center" />
      <Straight position={[0, 0, -30]} coins="left" />
      <Straight position={[0, 0, -40]} coins="left" />
      <Straight position={[0, 0, -50]} />

      {/* Ramp up */}
      <RampUp position={[0, 0, -55]} />

      {/* Elevated section */}
      <Straight position={[0, 6.105, -105]} />
      <RCurve position={[0, 6.105, -115]} coins="center" />
      <Straight position={[37, 6.105, -139]} rotation={[0, Math.PI / 2, 0]} coins="center" />
      <RCurve position={[47, 6.105, -139]} rotation={[0, -Math.PI / 2, 0]} coins="center" />
      <LCurve position={[71, 6.105, -115]} rotation={[0, Math.PI, 0]} coins="center" />
      <RCurve position={[95, 6.105, -91]} rotation={[0, -Math.PI / 2, 0]} coins="center" />

      {/* Ramp down */}
      <RampDown position={[119, 6.105, -60]} rotation={[0, Math.PI, 0]} />

      {/* Return straights */}
      <Straight position={[119, 0, -10]} rotation={[0, Math.PI, 0]} coins="center" />
      <Straight position={[119, 0, -0]} rotation={[0, Math.PI, 0]} coins="center" />
      <Straight position={[119, 0, 10]} rotation={[0, Math.PI, 0]} coins="center" />
      <Straight position={[119, 0, 20]} rotation={[0, Math.PI, 0]} coins="center" />
      <Straight position={[119, 0, 30]} rotation={[0, Math.PI, 0]} />
    </>
  )
}
