import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import { BasicCar, type CarPhysicsOverrides } from './BasicCar'
import type { InputManager } from '../input/InputManager'
import { useGameStore } from '../hooks/useGameStore'

const PHYSICS: CarPhysicsOverrides = {
  driveForce: 1500,
  maxSteerAngle: Math.PI / 20
}

// Visual mapping: how the GLB model fits over the physics chassis
const BODY_SCALE = 2.3
const BODY_ROTATION: [number, number, number] = [0, Math.PI, 0]
const BODY_OFFSET: [number, number, number] = [0, -0.1, 0]

interface GreenCarProps {
  input: InputManager
}

export const GreenCar = ({ input }: GreenCarProps) => {
  const debug = useGameStore((s) => s.debug)
  const { scene } = useGLTF('/cars/green-car.glb')
  const model = useMemo(() => {
    const clone = scene.clone()
    clone.traverse((child: any) => {
      if (child.isMesh) {
        child.castShadow = true
        child.receiveShadow = true
        child.material = child.material.clone()
        child.material.transparent = !!debug
        child.material.opacity = debug ? 0.25 : 1
      }
    })
    return clone
  }, [scene, debug])

  return (
    <BasicCar input={input} physics={PHYSICS}>
      {() => (
        <primitive
          object={model}
          scale={BODY_SCALE}
          rotation={BODY_ROTATION}
          position={BODY_OFFSET}
        />
      )}
    </BasicCar>
  )
}

useGLTF.preload('/cars/family-car.glb')
