import { useGLTF } from '@react-three/drei'
import { RigidBody } from '@react-three/rapier'

interface BlenderTileProps {
  url: string
  position?: [number, number, number]
  rotation?: [number, number, number]
  scale?: number
}

export function BlenderTile({ url, position = [0, 0, 0], rotation = [0, 0, 0], scale = 1 }: BlenderTileProps) {
  const { scene } = useGLTF(url)

  return (
    <RigidBody type="fixed" colliders="trimesh" position={position} rotation={rotation} scale={scale}>
      <primitive object={scene.clone()} />
    </RigidBody>
  )
}
