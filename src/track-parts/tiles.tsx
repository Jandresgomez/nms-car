import { useGLTF } from '@react-three/drei'
import { RigidBody } from '@react-three/rapier'
import { Coin } from '../components/Coin'
import { TRACK_SCALE } from './constants'

const COIN_Y = 1.5 / TRACK_SCALE // coin height in local (pre-scale) space

const STRAIGHT_COINS = {
  center: [[0, 0]] as [number, number][],
  left: [[-1.5, 0]] as [number, number][],
  right: [[1.5, 0]] as [number, number][],
}

// RCurve road surface analysis (pre-scale coords):
//   Entry: center x=0, z≈+2.2
//   The road arcs right: through roughly (-1.5, -6), (0.5, -8.5), (3.3, -10.1)
//   Exit: center x≈8, z≈-10.4
// 3 coin points along the centerline:
const RCURVE_COINS = {
  center: [[0.2, -4], [1.2, -6], [2.7, -7.2]] as [number, number][],
  left: [[-1, -2], [-2, -6], [2, -10]] as [number, number][],
  right: [[1, -2], [0, -6], [4, -10]] as [number, number][],
}

// LCurve is the mirror of RCurve on X axis
const LCURVE_COINS = {
  center: [[-0.2, -4], [-1.2, -6], [-2.7, -7.2]] as [number, number][],
  left: [[1, -2], [2, -6], [-2, -10]] as [number, number][],
  right: [[-1, -2], [0, -6], [-4, -10]] as [number, number][],
}

const RAMP_COINS = {
  center: [[0, -3], [0, -7], [0, -11]] as [number, number][],
  left: [[-1.5, -3], [-1.5, -7], [-1.5, -11]] as [number, number][],
  right: [[1.5, -3], [1.5, -7], [1.5, -11]] as [number, number][],
}

export type CoinLayout = 'center' | 'left' | 'right'

interface TileProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
  coins?: CoinLayout
}

function Tile({
  url,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  coins,
  coinPositions,
}: TileProps & { url: string; coinPositions: Record<CoinLayout, [number, number][]> }) {
  const { scene } = useGLTF(url)

  return (
    <group position={position} rotation={rotation}>
      <RigidBody type="fixed" colliders="trimesh" scale={TRACK_SCALE}>
        <primitive object={scene.clone()} />
      </RigidBody>
      {coins && coinPositions[coins].map(([lx, lz], i) => (
        <Coin key={i} position={[lx * TRACK_SCALE, COIN_Y * TRACK_SCALE, lz * TRACK_SCALE]} />
      ))}
    </group>
  )
}

export function Straight(props: TileProps) {
  return <Tile url="/straight.glb" coinPositions={STRAIGHT_COINS} {...props} />
}

export function LCurve(props: TileProps) {
  return <Tile url="/lcurve.glb" coinPositions={LCURVE_COINS} {...props} />
}

export function RCurve(props: TileProps) {
  return <Tile url="/rcurve.glb" coinPositions={RCURVE_COINS} {...props} />
}

export function RampUp(props: TileProps) {
  return <Tile url="/ramp-up.glb" coinPositions={RAMP_COINS} {...props} />
}

export function RampDown(props: TileProps) {
  return <Tile url="/ramp-down.glb" coinPositions={RAMP_COINS} {...props} />
}
