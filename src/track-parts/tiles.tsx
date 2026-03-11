import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import { RigidBody, CuboidCollider, TrimeshCollider } from '@react-three/rapier'
import * as THREE from 'three'
import { Coin } from '../components/Coin'
import { TRACK_SCALE } from './constants'
import { useGameStore } from '../hooks/useGameStore'

const COIN_Y = 2.5 / TRACK_SCALE // coin height in local (pre-scale) space

const STRAIGHT_COINS = {
  center: [[0, 0]] as [number, number][],
  left: [[-1.5, 0]] as [number, number][],
  right: [[1.5, 0]] as [number, number][],
}

const RCURVE_COINS = {
  center: [[0.2, -4], [1.2, -6], [2.7, -7.2]] as [number, number][],
  left: [[-1, -2], [-2, -6], [2, -10]] as [number, number][],
  right: [[1, -2], [0, -6], [4, -10]] as [number, number][],
}

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

const TILE_URLS: Record<TileType, string> = {
  straight: '/exports/straight.glb',
  lcurve: '/exports/lcurve.glb',
  rcurve: '/exports/rcurve.glb',
  dramp: '/exports/dramp.glb',
  uramp: '/exports/uramp.glb',
}

export type CoinLayout = 'center' | 'left' | 'right'
export type TileType = 'straight' | 'lcurve' | 'rcurve' | 'dramp' | 'uramp'

type GenericTileProps = {
  position?: [number, number, number]
  rotation?: [number, number, number]
  coins?: CoinLayout
}

type TileProps = {
  tile: TileType
  coinPositions: Record<CoinLayout, [number, number][]>
} & GenericTileProps

type CuboidData = { center: THREE.Vector3; halfExtents: THREE.Vector3 }
type TrimeshData = { vertices: Float32Array; indices: Uint32Array }

function useTileParts(scene: THREE.Object3D) {
  return useMemo(() => {
    const cuboids: CuboidData[] = []
    const trimeshes: TrimeshData[] = []

    // Clone scene and strip col_ nodes → preserves full parent transforms for visuals
    const visualScene = scene.clone(true)
    const toRemove: THREE.Object3D[] = []
    visualScene.traverse((child) => {
      if (child.name.startsWith('col_')) toRemove.push(child)
    })
    toRemove.forEach((c) => c.removeFromParent())

    // Extract collider data (uses world matrices so parent transforms are baked in)
    scene.traverse((child) => {
      const name = child.name
      if (name.startsWith('col_cuboid') && (child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh
        mesh.updateWorldMatrix(true, false)
        const geo = mesh.geometry
        geo.computeBoundingBox()
        const box = geo.boundingBox!.clone().applyMatrix4(mesh.matrixWorld)
        const center = new THREE.Vector3()
        const size = new THREE.Vector3()
        box.getCenter(center)
        box.getSize(size)
        cuboids.push({ center, halfExtents: size.multiplyScalar(0.5) })
      } else if (name.startsWith('col_') && (child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh
        mesh.updateWorldMatrix(true, false)
        const geo = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld)
        const pos = geo.attributes.position.array as Float32Array
        const idx = geo.index
          ? new Uint32Array(geo.index.array)
          : Uint32Array.from({ length: pos.length / 3 }, (_, i) => i)
        trimeshes.push({ vertices: new Float32Array(pos), indices: idx })
      }
    })

    return { visualScene, cuboids, trimeshes }
  }, [scene])
}

const Tile = ({
  tile,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  coins,
  coinPositions,
}: TileProps) => {
  const { scene } = useGLTF(TILE_URLS[tile])
  const { visualScene, cuboids, trimeshes } = useTileParts(scene)
  const debug = useGameStore((s) => s.debug)

  // Apply opacity when debug colliders are shown
  useMemo(() => {
    visualScene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh
        const mat = mesh.material as THREE.MeshStandardMaterial
        if (!mat.userData.originalOpacity) mat.userData.originalOpacity = mat.opacity
        mat.transparent = debug
        mat.opacity = debug ? 0.25 : mat.userData.originalOpacity
      }
    })
  }, [visualScene, debug])

  return (
    <group position={position} rotation={rotation}>
      {/* Visual meshes (full hierarchy preserved) */}
      <group scale={TRACK_SCALE}>
        <primitive object={visualScene} />
      </group>

      {/* Cuboid colliders */}
      {cuboids.map((b, i) => (
        <RigidBody key={`cb-${i}`} type="fixed" colliders={false}>
          <CuboidCollider
            args={[
              b.halfExtents.x * TRACK_SCALE,
              b.halfExtents.y * TRACK_SCALE,
              b.halfExtents.z * TRACK_SCALE,
            ]}
            position={[
              b.center.x * TRACK_SCALE,
              b.center.y * TRACK_SCALE,
              b.center.z * TRACK_SCALE,
            ]}
          />
        </RigidBody>
      ))}

      {/* Trimesh colliders */}
      {trimeshes.map((t, i) => (
        <RigidBody key={`tm-${i}`} type="fixed" colliders={false}>
          <TrimeshCollider
            args={[
              // scale vertices inline
              new Float32Array(t.vertices.map((v) => v * TRACK_SCALE)),
              t.indices,
            ]}
          />
        </RigidBody>
      ))}

      {/* Coins */}
      {coins && coinPositions[coins].map(([lx, lz], i) => (
        <Coin key={i} position={[lx * TRACK_SCALE, COIN_Y * TRACK_SCALE, lz * TRACK_SCALE]} />
      ))}
    </group>
  )
}

export function Straight(props: GenericTileProps) {
  return <Tile tile="straight" coinPositions={STRAIGHT_COINS} {...props} />
}

export function LCurve(props: GenericTileProps) {
  return <Tile tile="lcurve" coinPositions={LCURVE_COINS} {...props} />
}

export function RCurve(props: GenericTileProps) {
  return <Tile tile="rcurve" coinPositions={RCURVE_COINS} {...props} />
}

export function RampUp(props: GenericTileProps) {
  return <Tile tile="uramp" coinPositions={RAMP_COINS} {...props} />
}

export function RampDown(props: GenericTileProps) {
  return <Tile tile="dramp" coinPositions={RAMP_COINS} {...props} />
}
