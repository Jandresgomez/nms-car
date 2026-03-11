import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { RigidBody, BallCollider, useRapier, type RapierRigidBody } from '@react-three/rapier'
import { Vector3, Euler, Quaternion, MathUtils, Mesh } from 'three'
import { Ray } from '@dimforge/rapier3d-compat'
import { useDebugStore } from '../hooks/useDebugStore'
import type { InputManager } from '../input/InputManager'

// --- Tuning ---
const RADIUS = 1
const MASS = 5
const MOVE_FORCE = 80
const MAX_SPEED = 22
const JUMP_IMPULSE = 8
const GROUND_RAY_LEN = RADIUS + 0.4
const TILT_ANGLE = MathUtils.degToRad(15)
const TILT_SPEED = 8

// Reusable vectors
const _fwd = new Vector3()
const _right = new Vector3()
const _force = new Vector3()
const _up = new Vector3(0, 1, 0)
const _normal = new Vector3()
const _projected = new Vector3()

interface BallProps {
  input: InputManager
  debug?: boolean
}

export function Ball({ input, debug }: BallProps) {
  const body = useRef<RapierRigidBody>(null)
  const meshRef = useRef<Mesh>(null)
  const { camera } = useThree()
  const { world } = useRapier()
  const debugSet = useDebugStore((s) => s.set)
  const jumpCooldown = useRef(0)
  const tiltX = useRef(0)
  const tiltZ = useRef(0)

  useFrame((_, delta) => {
    const rb = body.current
    if (!rb) return
    const dt = Math.min(delta, 0.05)

    const { forward, backward, left, right, drift: jump } = input.getState()
    jumpCooldown.current = Math.max(0, jumpCooldown.current - dt)

    const pos = rb.translation()

    // --- Ground check + surface normal ---
    const ray = new Ray({ x: pos.x, y: pos.y, z: pos.z }, { x: 0, y: -1, z: 0 })
    const hit = world.castRay(ray, GROUND_RAY_LEN, true, 2, undefined, undefined, rb)
    const grounded = hit !== null && hit.timeOfImpact <= GROUND_RAY_LEN

    // Get surface normal when grounded
    _normal.set(0, 1, 0)
    if (grounded && hit !== null) {
      const collider = hit.collider
      if (collider) {
        const n = ray.pointAt(hit.timeOfImpact)
        const normal = collider.castRayAndGetNormal(ray, GROUND_RAY_LEN, true)
        if (normal) {
          _normal.set(normal.normal.x, normal.normal.y, normal.normal.z)
        }
      }
    }

    // --- Camera-relative directions ---
    const camEuler = new Euler().setFromQuaternion(camera.quaternion, 'YXZ')
    _fwd.set(0, 0, -1).applyAxisAngle(_up, camEuler.y)
    _right.set(1, 0, 0).applyAxisAngle(_up, camEuler.y)

    // --- Movement via direct velocity control ---
    _force.set(0, 0, 0)
    if (forward) _force.addScaledVector(_fwd, 1)
    if (backward) _force.addScaledVector(_fwd, -1)
    if (right) _force.addScaledVector(_right, 1)
    if (left) _force.addScaledVector(_right, -1)

    const lv = rb.linvel()
    let vx = lv.x, vy = lv.y, vz = lv.z
    const hSpeed = Math.sqrt(vx * vx + vz * vz)

    if (_force.lengthSq() > 0) {
      _force.normalize()

      // Project onto slope plane when grounded
      if (grounded) {
        const dot = _force.dot(_normal)
        _projected.copy(_normal).multiplyScalar(dot)
        _force.sub(_projected).normalize()
      }

      // Accelerate: scale by how much room we have under max speed
      const room = Math.max(0, 1 - hSpeed / MAX_SPEED)
      const accel = MOVE_FORCE / MASS * dt * room
      vx += _force.x * accel
      vy += _force.y * accel
      vz += _force.z * accel
    }

    // Hard clamp horizontal speed
    const newHSpeed = Math.sqrt(vx * vx + vz * vz)
    if (newHSpeed > MAX_SPEED) {
      const s = MAX_SPEED / newHSpeed
      vx *= s
      vz *= s
    }

    rb.setLinvel({ x: vx, y: vy, z: vz }, true)

    // --- Jump ---
    if (jump && grounded && jumpCooldown.current <= 0) {
      rb.applyImpulse({ x: 0, y: JUMP_IMPULSE * rb.mass(), z: 0 }, true)
      jumpCooldown.current = 0.35
    }

    rb.wakeUp()

    // --- Visual tilt ---
    const targetTiltX = (forward ? -TILT_ANGLE : 0) + (backward ? TILT_ANGLE : 0)
    const targetTiltZ = (left ? -TILT_ANGLE : 0) + (right ? TILT_ANGLE : 0)
    const lerpFactor = 1 - Math.exp(-TILT_SPEED * dt)
    tiltX.current = MathUtils.lerp(tiltX.current, targetTiltX, lerpFactor)
    tiltZ.current = MathUtils.lerp(tiltZ.current, targetTiltZ, lerpFactor)

    if (meshRef.current) {
      const tiltQ = new Quaternion().setFromEuler(new Euler(tiltX.current, 0, tiltZ.current, 'XYZ'))
      const camYawQ = new Quaternion().setFromAxisAngle(_up, camEuler.y)
      camYawQ.multiply(tiltQ)
      meshRef.current.quaternion.copy(camYawQ)
    }

    // --- Debug ---
    const rot = rb.rotation()
    const rotEuler = new Euler().setFromQuaternion(new Quaternion(rot.x, rot.y, rot.z, rot.w), 'XYZ')
    debugSet({
      speed: +newHSpeed.toFixed(1),
      forward, braking: backward, left, right, drift: jump,
      grounded,
      rotX: +MathUtils.radToDeg(rotEuler.x).toFixed(1),
      rotY: +MathUtils.radToDeg(rotEuler.y).toFixed(1),
      rotZ: +MathUtils.radToDeg(rotEuler.z).toFixed(1),
      velX: +vx.toFixed(2), velY: +vy.toFixed(2), velZ: +vz.toFixed(2),
      velMag: +Math.sqrt(vx * vx + vy * vy + vz * vz).toFixed(2),
      fl: false, fr: false, rl: false, rr: false,
      steerAngle: 0,
    })
  })

  return (
    <RigidBody
      ref={body}
      colliders={false}
      mass={MASS}
      position={[0, 3, 0]}
      linearDamping={1.5}
      angularDamping={4}
      ccd
      name="ball"
      enabledRotations={[false, false, false]}
    >
      <BallCollider args={[RADIUS]} friction={1.2} restitution={0} />
      <mesh ref={meshRef} castShadow>
        <sphereGeometry args={[RADIUS, 32, 32]} />
        <meshStandardMaterial
          color="#ff6b35"
          metalness={0.4}
          roughness={0.3}
          transparent={!!debug}
          opacity={debug ? 0.25 : 1}
        />
      </mesh>
    </RigidBody>
  )
}
