import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { RigidBody, CuboidCollider, useRapier, type RapierRigidBody } from '@react-three/rapier'
import { useGLTF } from '@react-three/drei'
import { Vector3, Quaternion, Object3D, InstancedMesh, type Object3D as Object3DType } from 'three'
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
const DRIFT_STEER_MULTIPLIER = 2;
const DRIFT_LF_MULTIPLIER = 1;
const AIR_YAW_SPEED = 0.5

// Raycast suspension parameters
// Gravity is 9.81, mass is 100, so weight = 981N across 4 wheels = ~245N per wheel at rest
const SUSPENSION_REST_LENGTH = 0.4
const SUSPENSION_MAX_LENGTH = 0.6
const WHEEL_PHYS_RADIUS_FRONT = 0.8
const WHEEL_PHYS_RADIUS_REAR = 1.2
const SUSPENSION_STIFFNESS = 400
const SUSPENSION_DAMPING = 600
const MAX_SUSPENSION_FORCE = 300

const WHEEL_CENTERS = [
  { name: 'FL', pos: [-1.05, 0.5, -1.75] as const },
  { name: 'FR', pos: [1.05, 0.5, -1.75] as const },
  { name: 'RL', pos: [-1.05, 0.5, 1.6] as const },
  { name: 'RR', pos: [1.05, 0.5, 1.6] as const },
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

// Wheel node names in GLB mapped to FL, FR, RL, RR order
// Wheel node names in GLB — each wheel position has two sub-meshes (_0000 and _0001)
const WHEEL_GROUPS = [
  { // FL
    names: ['Car2S1_Wheel_Moving_0000_0000', 'Car2S1_Wheel_Moving_0000_0001'],
    centers: [new Vector3(-0.8438, 0, 1.3871), new Vector3(-0.9557, 0, 1.3871)],
  },
  { // FR
    names: ['Car2S1_Wheel_Moving_0001_0000', 'Car2S1_Wheel_Moving_0001_0001'],
    centers: [new Vector3(0.8438, 0, 1.3871), new Vector3(0.9557, 0, 1.3871)],
  },
  { // RL
    names: ['Car2S1_Wheel_Moving_0002_0000', 'Car2S1_Wheel_Moving_0002_0001'],
    centers: [new Vector3(-0.8438, 0, -1.2981), new Vector3(-0.9733, 0, -1.2981)],
  },
  { // RR
    names: ['Car2S1_Wheel_Moving_0003_0000', 'Car2S1_Wheel_Moving_0003_0001'],
    centers: [new Vector3(0.8438, 0, -1.2981), new Vector3(0.9733, 0, -1.2981)],
  },
]
const WHEEL_RADIUS = 0.004 // model-local radius (approx from GLB bounds)

interface HotRodProps {
  input: InputManager
  debug?: boolean
}

const _fwd = new Vector3()
const _right = new Vector3()
const _localDown = new Vector3()
const _wheelWorld = new Vector3()
const _wpos = new Vector3()
const _obj = new Object3D()
const _spinAxis = new Vector3(1, 0, 0)

export function HotRod({ input, debug }: HotRodProps) {
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

  const wheelNodes = useRef<{ node: Object3DType; center: Vector3 }[][]>([[], [], [], []])
  useMemo(() => {
    WHEEL_GROUPS.forEach((group, i) => {
      wheelNodes.current[i] = group.names.map((name, j) => ({
        node: model.getObjectByName(name)!,
        center: group.centers[j],
      })).filter(w => w.node)
    })
    // Hide static wheel meshes so only the animated Wheel_Moving ones are visible
    model.traverse((child: any) => {
      if (child.name && /^Car2S1_Wheel_(000|LOD_000)/.test(child.name)) {
        child.visible = false
      }
    })
  }, [model])

  // Update model opacity when debug toggles
  useMemo(() => {
    model.traverse((child: any) => {
      if (child.isMesh) {
        child.material = child.material.clone()
        child.material.transparent = !!debug
        child.material.opacity = debug ? 0.25 : 1
      }
    })
  }, [model, debug])

  const { world } = useRapier()
  const steerAngle = useRef(0)
  const particles = useRef<Particle[]>(
    Array.from({ length: MAX_PARTICLES }, () => ({ alive: false, age: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 }))
  )
  const spawnTimer = useRef(0)
  const wheelSpin = useRef(0)

  useFrame((_, delta) => {
    if (!body.current) return
    const dt = Math.min(delta, 0.05)

    const { forward, backward: brake, left, right: rightInput, drift } = input.getState()

    const pos = body.current.translation()
    const rot = body.current.rotation()
    const quat = new Quaternion(rot.x, rot.y, rot.z, rot.w)

    _fwd.set(0, 0, -1).applyQuaternion(quat)
    _right.set(1, 0, 0).applyQuaternion(quat)
    _localDown.set(0, -1, 0).applyQuaternion(quat)

    const lv = body.current.linvel()
    const forwardSpeed = lv.x * _fwd.x + lv.y * _fwd.y + lv.z * _fwd.z
    const lateralSpeed = lv.x * _right.x + lv.z * _right.z

    // ── Raycast suspension ──
    const wheelGrounded = [false, false, false, false]
    const verticalVel = lv.y
    let totalSuspensionForce = 0

    // Store compression per wheel for debug
    const wheelComp = [0, 0, 0, 0]

    body.current.resetForces(true)

    for (let i = 0; i < 4; i++) {
      const w = WHEEL_CENTERS[i]
      _wheelWorld.set(w.pos[0], w.pos[1], w.pos[2]).applyQuaternion(quat)
      _wheelWorld.x += pos.x; _wheelWorld.y += pos.y; _wheelWorld.z += pos.z
      const wheelRadius = i < 2 ? WHEEL_PHYS_RADIUS_FRONT : WHEEL_PHYS_RADIUS_REAR
      // Offset ray origin up by wheel radius so ray accounts for wheel size
      _wheelWorld.x -= _localDown.x * wheelRadius
      _wheelWorld.y -= _localDown.y * wheelRadius
      _wheelWorld.z -= _localDown.z * wheelRadius

      const rayLen = SUSPENSION_MAX_LENGTH + wheelRadius
      const hit = world.castRay(
        new Ray({ x: _wheelWorld.x, y: _wheelWorld.y, z: _wheelWorld.z }, { x: _localDown.x, y: _localDown.y, z: _localDown.z }),
        rayLen, true, 2, undefined, undefined, body.current!,
      )

      if (hit !== null && hit.timeOfImpact <= rayLen) {
        wheelGrounded[i] = true
        const compression = (SUSPENSION_REST_LENGTH + wheelRadius) - hit.timeOfImpact
        wheelComp[i] = compression
        const springForce = Math.min(
          Math.max(SUSPENSION_STIFFNESS * compression - SUSPENSION_DAMPING * verticalVel, 0),
          MAX_SUSPENSION_FORCE,
        )
        totalSuspensionForce += springForce
      } else {
        // wheel airborne — no force
      }
    }

    // Apply suspension as single upward force at center of mass (no torque = no flipping)
    if (totalSuspensionForce > 0) {
      body.current.addForce({ x: 0, y: totalSuspensionForce, z: 0 }, true)
    }

    const groundedCount = wheelGrounded.filter(Boolean).length
    const isGrounded = groundedCount >= 2

    // ── Uprighting torque — when 2+ wheels are airborne, correct tilt back to upright ──
    const av = body.current.angvel()
    if (groundedCount < 4) {
      // Car's local up vs world up — cross product gives the rotation axis and sin(angle)
      _localDown.negate() // reuse as local up
      const corrX = -_localDown.z  // cross(worldUp, localUp).x
      const corrZ = _localDown.x   // cross(worldUp, localUp).z
      const uprightStrength = 80
      const uprightDamping = 30
      body.current.setAngvel({
        x: av.x + (corrX * uprightStrength - av.x * uprightDamping) * dt,
        y: av.y,
        z: av.z + (corrZ * uprightStrength - av.z * uprightDamping) * dt,
      }, true)
      _localDown.negate() // restore to local down for any later use
    }

    // ── Steering ──
    let steerTarget = 0
    if (left) steerTarget = MAX_STEER_ANGLE
    if (rightInput) steerTarget = -MAX_STEER_ANGLE

    const sSpd = steerTarget !== 0 ? STEER_SPEED : STEER_RETURN_SPEED
    const sDiff = steerTarget - steerAngle.current
    steerAngle.current += Math.sign(sDiff) * Math.min(Math.abs(sDiff), sSpd * dt)

    const effectiveSteerAngle = drift ? steerAngle.current * DRIFT_STEER_MULTIPLIER : steerAngle.current
    const effectiveLateralFriction = drift ? LATERAL_FRICTION * DRIFT_LF_MULTIPLIER : LATERAL_FRICTION

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

      const currentAv = body.current.angvel()
      if (Math.abs(forwardSpeed) > 0.5) {
        const yawRate = (forwardSpeed * Math.tan(effectiveSteerAngle)) / WHEELBASE
        body.current.setAngvel({ x: currentAv.x, y: yawRate, z: currentAv.z }, true)
      } else {
        body.current.setAngvel({ x: currentAv.x, y: 0, z: currentAv.z }, true)
      }
    } else if (groundedCount === 0) {
      // Tank turn in the air
      const airYaw = (left ? 1 : 0) + (rightInput ? -1 : 0)
      if (airYaw !== 0) {
        const currentAv = body.current.angvel()
        body.current.setAngvel({ x: currentAv.x, y: airYaw * AIR_YAW_SPEED, z: currentAv.z }, true)
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

    // ── Visual wheel spin + steering ──
    wheelSpin.current += (forwardSpeed / 125) / WHEEL_RADIUS * dt
    for (let i = 0; i < 4; i++) {
      const isFront = i < 2
      const steerY = isFront ? effectiveSteerAngle * 1.2 : 0
      for (const { node, center } of wheelNodes.current[i]) {
        node.rotation.set(wheelSpin.current, steerY, 0, 'YXZ')
        node.position.copy(center).negate()
        node.position.applyEuler(node.rotation)
        node.position.add(center)
      }
    }

    const fc = (v: number) => (v >= 0 ? '+' : '') + v.toFixed(3)
    debugSet({
      speed: +Math.abs(forwardSpeed).toFixed(1),
      forward, braking: brake, left, right: rightInput, drift,
      grounded: isGrounded,
      fl: wheelGrounded[0], fr: wheelGrounded[1], rl: wheelGrounded[2], rr: wheelGrounded[3],
      steerAngle: +steerAngle.current.toFixed(2),
      flC: fc(wheelComp[0]), frC: fc(wheelComp[1]),
      rlC: fc(wheelComp[2]), rrC: fc(wheelComp[3]),
    })
  })

  return (
    <>
      <RigidBody
        ref={body} colliders={false} mass={100} position={[0, 3, 0]}
        linearDamping={0.1} angularDamping={0.5} ccd name="car"
      >
        <CuboidCollider args={[1.0, 0.6, 2.2]} friction={0.1} position={[0, 1, 0]} />
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
