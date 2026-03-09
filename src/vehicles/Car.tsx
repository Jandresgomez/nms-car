import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { RigidBody, CuboidCollider, BallCollider, useRapier, type RapierRigidBody } from '@react-three/rapier'
import { useGLTF } from '@react-three/drei'
import { Vector3, Quaternion, Object3D, InstancedMesh } from 'three'
import { Ray } from '@dimforge/rapier3d-compat'
import { useDebugStore } from '../hooks/useDebugStore'
import type { InputManager } from '../input/InputManager'

const MAX_SPEED = 30
const ENGINE_FORCE = 500
const BRAKE_FORCE = 500
const REVERSE_FORCE = 500
const REVERSE_MAX = 10
const MAX_STEER_ANGLE = 0.2
const STEER_SPEED = 3
const STEER_RETURN_SPEED = 5
const WHEELBASE = 3.35
const LATERAL_FRICTION = 4
const GROUND_RAY_LEN = 1.2

const FRONT_WHEEL_RADIUS = 0.5
const REAR_WHEEL_RADIUS = 0.5

const WHEEL_CENTERS = [
  { name: 'FL', pos: [-1.05, 0.5, -1.75] as const, r: FRONT_WHEEL_RADIUS },
  { name: 'FR', pos: [1.05, 0.5, -1.75] as const, r: FRONT_WHEEL_RADIUS },
  { name: 'RL', pos: [-1.05, 0.5, 1.6] as const, r: REAR_WHEEL_RADIUS },
  { name: 'RR', pos: [1.05, 0.5, 1.6] as const, r: REAR_WHEEL_RADIUS },
]

// Rear wheel local offsets for smoke
const REAR_OFFSETS = [
  new Vector3(-1.05, 0.2, 1.6),
  new Vector3(1.05, 0.2, 1.6),
]

// Particles
const MAX_PARTICLES = 60
const PARTICLE_LIFE = 0.8
const SPAWN_INTERVAL = 0.02

interface Particle {
  alive: boolean
  age: number
  x: number; y: number; z: number
  vx: number; vy: number; vz: number
}

interface CarProps {
  input: InputManager
  resetRef?: React.RefObject<(() => void) | null>
}

const _fwd = new Vector3()
const _right = new Vector3()
const _wheelWorld = new Vector3()
const _wpos = new Vector3()
const _obj = new Object3D()

export function Car({ input, resetRef }: CarProps) {
  const body = useRef<RapierRigidBody>(null)
  const smokeRef = useRef<InstancedMesh>(null)
  const debugSet = useDebugStore((s) => s.set)
  const { scene } = useGLTF('/hot_rod_burnout_revenge_sd.glb')
  const model = useMemo(() => {
    const clone = scene.clone()
    clone.traverse((child: any) => {
      if (child.isMesh) { child.castShadow = true; child.receiveShadow = true }
    })
    return clone
  }, [scene])

  const { world } = useRapier()
  const steerAngle = useRef(0)
  const particles = useRef<Particle[]>(
    Array.from({ length: MAX_PARTICLES }, () => ({ alive: false, age: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 }))
  )
  const spawnTimer = useRef(0)

  useEffect(() => {
    if (!resetRef) return
    resetRef.current = () => {
      if (!body.current) return
      body.current.setTranslation({ x: 0, y: 3, z: 0 }, true)
      body.current.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true)
      body.current.setLinvel({ x: 0, y: 0, z: 0 }, true)
      body.current.setAngvel({ x: 0, y: 0, z: 0 }, true)
      steerAngle.current = 0
    }
  })

  useFrame((_, delta) => {
    if (!body.current) return
    const dt = Math.min(delta, 0.05)

    const { forward, backward: brake, left, right: rightInput, drift } = input.getState()

    const pos = body.current.translation()
    const rot = body.current.rotation()
    const quat = new Quaternion(rot.x, rot.y, rot.z, rot.w)

    _fwd.set(0, 0, -1).applyQuaternion(quat)
    _right.set(1, 0, 0).applyQuaternion(quat)

    const lv = body.current.linvel()
    const forwardSpeed = lv.x * _fwd.x + lv.y * _fwd.y + lv.z * _fwd.z
    const lateralSpeed = lv.x * _right.x + lv.z * _right.z

    // ── Ground detection ──
    const wheelGrounded = [false, false, false, false]
    for (let i = 0; i < 4; i++) {
      const w = WHEEL_CENTERS[i]
      _wheelWorld.set(w.pos[0], w.pos[1], w.pos[2]).applyQuaternion(quat)
      _wheelWorld.x += pos.x; _wheelWorld.y += pos.y; _wheelWorld.z += pos.z

      const hit = world.castRay(
        new Ray({ x: _wheelWorld.x, y: _wheelWorld.y, z: _wheelWorld.z }, { x: 0, y: -1, z: 0 }),
        GROUND_RAY_LEN, true, undefined, undefined, undefined, body.current!,
      )
      wheelGrounded[i] = hit !== null && hit.timeOfImpact <= GROUND_RAY_LEN
    }
    const groundedCount = wheelGrounded.filter(Boolean).length
    const isGrounded = groundedCount >= 2

    body.current.resetForces(true)

    // ── Steering ──
    let steerTarget = 0
    if (left) steerTarget = MAX_STEER_ANGLE
    if (rightInput) steerTarget = -MAX_STEER_ANGLE

    const sSpd = steerTarget !== 0 ? STEER_SPEED : STEER_RETURN_SPEED
    const sDiff = steerTarget - steerAngle.current
    steerAngle.current += Math.sign(sDiff) * Math.min(Math.abs(sDiff), sSpd * dt)

    const effectiveSteerAngle = drift ? steerAngle.current * 1.5 : steerAngle.current
    const effectiveLateralFriction = drift ? LATERAL_FRICTION * 0.3 : LATERAL_FRICTION

    if (isGrounded) {
      let force = 0
      if (forward && forwardSpeed < MAX_SPEED) {
        force = ENGINE_FORCE
      } else if (brake) {
        force = forwardSpeed > 0.5 ? -BRAKE_FORCE : forwardSpeed > -REVERSE_MAX ? -REVERSE_FORCE : 0
      }

      if (force !== 0) {
        body.current.addForce({ x: _fwd.x * force, y: _fwd.y * force, z: _fwd.z * force }, true)
      }

      if (Math.abs(lateralSpeed) > 0.1) {
        const lateralForce = -lateralSpeed * effectiveLateralFriction * body.current.mass()
        body.current.addForce({ x: _right.x * lateralForce, y: 0, z: _right.z * lateralForce }, true)
      }

      const av = body.current.angvel()
      if (Math.abs(forwardSpeed) > 0.5) {
        const yawRate = (forwardSpeed * Math.tan(effectiveSteerAngle)) / WHEELBASE
        body.current.setAngvel({ x: av.x, y: yawRate, z: av.z }, true)
      } else {
        body.current.setAngvel({ x: av.x, y: 0, z: av.z }, true)
      }
    }

    body.current.wakeUp()

    // ── Drift smoke particles (inline) ──
    const isDrifting = drift && isGrounded && Math.abs(forwardSpeed) > 2
    const ps = particles.current

    if (isDrifting) {
      spawnTimer.current -= dt
      if (spawnTimer.current <= 0) {
        spawnTimer.current = SPAWN_INTERVAL
        for (const offset of REAR_OFFSETS) {
          _wpos.copy(offset).applyQuaternion(quat)
          _wpos.x += pos.x; _wpos.y += pos.y; _wpos.z += pos.z
          const p = ps.find(p => !p.alive)
          if (!p) continue
          p.alive = true; p.age = 0
          p.x = _wpos.x + (Math.random() - 0.5) * 0.3
          p.y = _wpos.y
          p.z = _wpos.z + (Math.random() - 0.5) * 0.3
          p.vx = (Math.random() - 0.5) * 1
          p.vy = 0.5 + Math.random() * 0.5
          p.vz = (Math.random() - 0.5) * 1
        }
      }
    }

    if (smokeRef.current) {
      for (let i = 0; i < MAX_PARTICLES; i++) {
        const p = ps[i]
        if (p.alive) {
          p.age += dt
          if (p.age >= PARTICLE_LIFE) { p.alive = false }
          else {
            p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt
          }
        }
        const scale = p.alive ? 0.15 + (p.age / PARTICLE_LIFE) * 0.3 : 0
        _obj.position.set(p.x, p.y, p.z)
        _obj.scale.setScalar(scale)
        _obj.updateMatrix()
        smokeRef.current.setMatrixAt(i, _obj.matrix)
      }
      smokeRef.current.instanceMatrix.needsUpdate = true
    }

    debugSet({
      speed: +Math.abs(forwardSpeed).toFixed(1),
      forward, braking: brake, left, right: rightInput, drift,
      grounded: isGrounded,
      fl: wheelGrounded[0], fr: wheelGrounded[1], rl: wheelGrounded[2], rr: wheelGrounded[3],
      steerAngle: +steerAngle.current.toFixed(2),
    })
  })

  return (
    <>
      <RigidBody
        ref={body} colliders={false} mass={100} position={[0, 3, 0]}
        linearDamping={1} angularDamping={0} ccd name="car"
      >
        <CuboidCollider args={[1.0, 0.6, 2.2]} friction={0.1} position={[0, 1, 0]} />
        {WHEEL_CENTERS.map((w) => (
          <BallCollider key={w.name} args={[w.r]} friction={0} restitution={0}
            position={[w.pos[0], w.pos[1], w.pos[2]]} />
        ))}
        <primitive object={model} scale={125} position={[0, 0.5, 0]} rotation={[0, Math.PI, 0]} />
      </RigidBody>
      <instancedMesh ref={smokeRef} args={[undefined, undefined, MAX_PARTICLES]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="white" transparent opacity={0.6} />
      </instancedMesh>
    </>
  )
}

useGLTF.preload('/hot_rod_burnout_revenge_sd.glb')
