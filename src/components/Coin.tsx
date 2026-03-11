import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { BallCollider, RigidBody } from '@react-three/rapier'
import { Group, DoubleSide, Object3D, InstancedMesh, Color } from 'three'
import { useGameStore } from '../hooks/useGameStore'

const ROTATION_PERIOD = 10
const BOB_PERIOD = 8
const BOB_AMPLITUDE = 0.3
const COIN_RADIUS = 1.5
const COIN_THICKNESS = 0.4

const PARTICLE_COUNT = 32
const PARTICLE_LIFE = 1.0
const COLORS = [new Color('#FFD700'), new Color('#FF6B6B'), new Color('#4ECDC4'), new Color('#45B7D1'), new Color('#FFFFFF')]

interface Particle {
  vx: number; vy: number; vz: number
  age: number
}

const _obj = new Object3D()

interface CoinProps {
  position: [number, number, number]
}

export function Coin({ position }: CoinProps) {
  const groupRef = useRef<Group>(null)
  const burstRef = useRef<InstancedMesh>(null)
  const [collected, setCollected] = useState(false)
  const [bursting, setBursting] = useState(false)
  const addCoin = useGameStore((s) => s.addCoin)
  const particles = useRef<Particle[]>([])

  useFrame(({ clock }, delta) => {
    if (!collected && groupRef.current) {
      const t = clock.getElapsedTime()
      groupRef.current.rotation.y = (t / ROTATION_PERIOD) * Math.PI * 2
      groupRef.current.position.y = Math.sin((t / BOB_PERIOD) * Math.PI * 2) * BOB_AMPLITUDE
    }

    if (bursting && burstRef.current) {
      const dt = Math.min(delta, 0.05)
      let allDead = true
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const p = particles.current[i]
        p.age += dt
        if (p.age < PARTICLE_LIFE) {
          allDead = false
          const progress = p.age / PARTICLE_LIFE
          p.vy -= 9 * dt
          _obj.position.set(
            position[0] + p.vx * p.age,
            position[1] + p.vy * p.age,
            position[2] + p.vz * p.age,
          )
          const s = 0.15 * (1 - progress * progress)
          _obj.scale.setScalar(s)
          _obj.updateMatrix()
          burstRef.current!.setMatrixAt(i, _obj.matrix)
        } else {
          _obj.scale.setScalar(0)
          _obj.updateMatrix()
          burstRef.current!.setMatrixAt(i, _obj.matrix)
        }
      }
      burstRef.current.instanceMatrix.needsUpdate = true
      if (allDead) setBursting(false)
    }
  })

  const onCollect = () => {
    setCollected(true)
    setBursting(true)
    addCoin()
    particles.current = Array.from({ length: PARTICLE_COUNT }, () => {
      const angle = Math.random() * Math.PI * 2
      const speed = 2 + Math.random() * 3
      return {
        vx: Math.cos(angle) * speed,
        vy: 8 + Math.random() * 6,
        vz: Math.sin(angle) * speed,
        age: 0,
      }
    })
    // Set initial colors
    if (burstRef.current) {
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        burstRef.current.setColorAt(i, COLORS[i % COLORS.length])
      }
      burstRef.current.instanceColor!.needsUpdate = true
    }
  }

  return (
    <>
      {!collected && (
        <RigidBody
          type="fixed"
          position={position}
          colliders={false}
          sensor
          onIntersectionEnter={({ other }) => {
            if (other.rigidBodyObject?.name === 'car') onCollect()
          }}
        >
          <BallCollider args={[COIN_RADIUS]} />
          <group ref={groupRef}>
            <mesh castShadow rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[COIN_RADIUS, COIN_RADIUS, COIN_THICKNESS, 24]} />
              <meshStandardMaterial color="#FFD700" emissive="#FFA500" emissiveIntensity={0.5} metalness={0.9} roughness={0.1} side={DoubleSide} />
            </mesh>
          </group>
        </RigidBody>
      )}
      {bursting && (
        <instancedMesh ref={burstRef} args={[undefined, undefined, PARTICLE_COUNT]} frustumCulled={false}>
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial toneMapped={false} />
        </instancedMesh>
      )}
    </>
  )
}
