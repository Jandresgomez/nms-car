import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { RigidBody, CuboidCollider, BallCollider, useRapier, type RapierRigidBody } from '@react-three/rapier'
import { useKeyboardControls, useGLTF } from '@react-three/drei'
import { Vector3, Quaternion } from 'three'
import { Ray } from '@dimforge/rapier3d-compat'
import type { MutableRefObject } from 'react'
import type { TouchControlState } from '../hooks/useTouchControls'
import { useDebugStore } from '../hooks/useDebugStore'

const ACCEL = 500
const BRAKE_ACCEL = 250
const REVERSE_ACCEL = 400
const TURN_SPEED = 2.5
const MAX_SPEED = 120
const MAX_REVERSE = 30
const JUMP_FORCE = 100
const GRIP = 0.92
const WHEEL_RAY_LEN = 2.0
const WHEEL_GROUND_DIST = 1.5

const WHEELS = [
  { name: 'FL', offset: new Vector3(-1.3, 0.5, -1.6) },
  { name: 'FR', offset: new Vector3(1.3, 0.5, -1.6) },
  { name: 'RL', offset: new Vector3(-1.3, 0.5, 1.6) },
  { name: 'RR', offset: new Vector3(1.3, 0.5, 1.6) },
] as const

interface WheelHit {
  grounded: boolean
  normal: Vector3 | null
}

interface CarProps {
  touchControls: MutableRefObject<TouchControlState>
}

// Reusable vectors to avoid per-frame allocations
const _worldPos = new Vector3()
const _posVec = new Vector3()
const _fwd = new Vector3()
const _up = new Vector3()
const _avgNormal = new Vector3()
const _driveDir = new Vector3()
const _right = new Vector3()
const _velVec = new Vector3()
const _fwdComponent = new Vector3()
const _lateral = new Vector3()

export function Car({ touchControls }: CarProps) {
  const body = useRef<RapierRigidBody>(null)
  const [, getKeys] = useKeyboardControls()
  const debugSet = useDebugStore((s) => s.set)
  const { scene } = useGLTF('/hot_rod_burnout_revenge_sd.glb')
  const model = useMemo(() => {
    const clone = scene.clone()
    clone.traverse((child: any) => {
      if (child.isMesh) {
        child.castShadow = true
        child.receiveShadow = true
      }
    })
    return clone
  }, [scene])

  const { world } = useRapier()
  const canJump = useRef(true)

  useFrame((_, delta) => {
    if (!body.current) return

    const keys = getKeys()
    const tc = touchControls.current
    const forward = keys.forward || tc.forward
    const braking = keys.backward || tc.backward
    const left = keys.left || tc.left
    const right = keys.right || tc.right
    const jump = keys.shoot || tc.shoot

    const pos = body.current.translation()
    const rot = body.current.rotation()
    const quat = new Quaternion(rot.x, rot.y, rot.z, rot.w)
    _posVec.set(pos.x, pos.y, pos.z)

    // Per-wheel raycast — collect surface normals
    const wheelHits: WheelHit[] = WHEELS.map((wheel) => {
      _worldPos.copy(wheel.offset).applyQuaternion(quat).add(_posVec)
      // Cast downward in world space
      const ray = world.castRay(
        new Ray({ x: _worldPos.x, y: _worldPos.y, z: _worldPos.z }, { x: 0, y: -1, z: 0 }),
        WHEEL_RAY_LEN,
        true,
        undefined,
        undefined,
        undefined,
        body.current!,
      )
      if (ray && ray.timeOfImpact < WHEEL_GROUND_DIST) {
        // Get the collider that was hit and compute the normal
        const hitPoint = {
          x: _worldPos.x,
          y: _worldPos.y - ray.timeOfImpact,
          z: _worldPos.z,
        }
        const collider = ray.collider
        const projected = collider.projectPoint(hitPoint, false)
        if (projected) {
          const n = new Vector3(
            hitPoint.x - projected.point.x,
            hitPoint.y - projected.point.y,
            hitPoint.z - projected.point.z,
          )
          if (n.lengthSq() > 0.0001) {
            n.normalize()
            return { grounded: true, normal: n }
          }
        }
        // Fallback: assume flat ground
        return { grounded: true, normal: new Vector3(0, 1, 0) }
      }
      return { grounded: false, normal: null }
    })

    const groundedCount = wheelHits.filter((w) => w.grounded).length
    const isGrounded = groundedCount >= 1
    const canDoJump = groundedCount >= 2

    // Average ground normal from all grounded wheels
    _avgNormal.set(0, 0, 0)
    for (const hit of wheelHits) {
      if (hit.grounded && hit.normal) _avgNormal.add(hit.normal)
    }
    if (groundedCount > 0) {
      _avgNormal.divideScalar(groundedCount).normalize()
    } else {
      _avgNormal.set(0, 1, 0)
    }

    // Car's local forward in world space
    _fwd.set(0, 0, -1).applyQuaternion(quat)

    // Project forward onto the ground plane: driveDir = fwd - normal * dot(fwd, normal)
    _driveDir.copy(_fwd).addScaledVector(_avgNormal, -_fwd.dot(_avgNormal))
    if (_driveDir.lengthSq() > 0.0001) {
      _driveDir.normalize()
    } else {
      _driveDir.copy(_fwd)
    }

    // Right vector for lateral grip (perpendicular to drive dir on ground plane)
    _right.crossVectors(_driveDir, _avgNormal).normalize()

    const vel = body.current.linvel()
    // Speed along the ground plane (not just XZ)
    const speed = Math.abs(_velVec.set(vel.x, vel.y, vel.z).dot(_driveDir))

    // Turning — apply torque around the surface normal instead of world Y
    let torqueAmount = 0
    if (left) torqueAmount += TURN_SPEED
    if (right) torqueAmount -= TURN_SPEED
    const turnFactor = Math.min(speed / 5, 1)
    body.current.setAngvel(
      {
        x: _avgNormal.x * torqueAmount * turnFactor,
        y: _avgNormal.y * torqueAmount * turnFactor,
        z: _avgNormal.z * torqueAmount * turnFactor,
      },
      true,
    )

    body.current.wakeUp()

    // Jump
    if (jump && canDoJump && canJump.current) {
      body.current.applyImpulse({ x: 0, y: JUMP_FORCE, z: 0 }, true)
      canJump.current = false
    }
    if (!jump) canJump.current = true

    // Accelerate along surface
    if (forward && isGrounded && speed < MAX_SPEED) {
      body.current.applyImpulse(
        {
          x: _driveDir.x * ACCEL * delta,
          y: _driveDir.y * ACCEL * delta,
          z: _driveDir.z * ACCEL * delta,
        },
        true,
      )
    }

    // Brake / reverse along surface
    if (braking && isGrounded) {
      const forwardComponent = _velVec.set(vel.x, vel.y, vel.z).dot(_driveDir)
      const accel = forwardComponent > 0 ? BRAKE_ACCEL : REVERSE_ACCEL
      const reverseSpeed = -forwardComponent
      if (reverseSpeed < MAX_REVERSE) {
        body.current.applyImpulse(
          {
            x: -_driveDir.x * accel * delta,
            y: -_driveDir.y * accel * delta,
            z: -_driveDir.z * accel * delta,
          },
          true,
        )
      }
    }

    // Lateral friction: remove sideways velocity relative to the ground plane
    if (isGrounded) {
      const postVel = body.current.linvel()
      _velVec.set(postVel.x, postVel.y, postVel.z)
      const lateralSpeed = _velVec.dot(_right)
      _lateral.copy(_right).multiplyScalar(lateralSpeed * (1 - GRIP))
      body.current.setLinvel(
        {
          x: postVel.x - _lateral.x,
          y: postVel.y - _lateral.y,
          z: postVel.z - _lateral.z,
        },
        true,
      )
    }

    const imp: [number, number, number] = forward
      ? [+_driveDir.x.toFixed(2), +_driveDir.y.toFixed(2), +_driveDir.z.toFixed(2)]
      : [0, 0, 0]
    debugSet({
      speed: +speed.toFixed(2),
      forward,
      braking,
      left,
      right,
      grounded: isGrounded,
      fl: wheelHits[0].grounded,
      fr: wheelHits[1].grounded,
      rl: wheelHits[2].grounded,
      rr: wheelHits[3].grounded,
      impulse: imp,
    })
  })

  return (
    <RigidBody
      ref={body}
      colliders={false}
      mass={1}
      position={[0, 3, 0]}
      linearDamping={0.1}
      angularDamping={4}
      name="car"
    >
      <CuboidCollider args={[1.0, 0.4, 2.2]} friction={0.1} position={[0, 1.2, 0]} />
      <BallCollider args={[0.5]} friction={0.8} restitution={0.1} position={[-1.3, 0.5, 1.6]} />
      <BallCollider args={[0.5]} friction={0.8} restitution={0.1} position={[1.3, 0.5, 1.6]} />
      <BallCollider args={[0.5]} friction={0.8} restitution={0.1} position={[-1.3, 0.5, -1.6]} />
      <BallCollider args={[0.5]} friction={0.8} restitution={0.1} position={[1.3, 0.5, -1.6]} />
      <primitive object={model} scale={125} position={[0, 0.5, 0]} rotation={[0, Math.PI, 0]} />
    </RigidBody>
  )
}

useGLTF.preload('/hot_rod_burnout_revenge_sd.glb')
