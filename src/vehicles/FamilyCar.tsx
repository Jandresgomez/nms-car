import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { RigidBody, CuboidCollider, useRapier, type RapierRigidBody } from '@react-three/rapier'
import { useGLTF } from '@react-three/drei'
import { MathUtils, Euler, Quaternion, Vector3 } from 'three'
import type { DynamicRayCastVehicleController } from '@dimforge/rapier3d-compat'
import { useDebugStore } from '../hooks/useDebugStore'
import type { InputManager } from '../input/InputManager'

// Exact reference values: chassis 2x1x4, wheels at ±1 x, ±1.5 z, y=0
// Reference wheel: radius 0.3, suspensionRest 0.8, stiffness 24, friction 1000
// Reference driving: accel step 1, max 30, brake step 0.05, max 1, steer pi/4, lerp 0.25
// Reference mass: 10, friction 0.8

const CHASSIS_HALF = [1, 0.5, 2] as const  // 2x1x4 box, exactly like reference
const CHASSIS_MASS = 200

const WHEEL_POSITIONS = [
  { x: -1.2, y: 0, z: -1.5 },  // wider track ±1.2
  { x: 1.2, y: 0, z: -1.5 },
  { x: -1.2, y: 0, z: 1.5 },
  { x: 1.2, y: 0, z: 1.5 },
]
const WHEEL_RADIUS = 0.3
const SUSPENSION_REST = 0.8
const SUSPENSION_STIFFNESS = 24.0
const SUSPENSION_COMPRESSION_DAMPING = 3.0
const SUSPENSION_RELAXATION_DAMPING = 4.5
const FRICTION_SLIP = 10
const ANTI_ROLL_STIFFNESS = 5.0

const ACCEL_STEP = 10
const ACCEL_MAX = 40
const BRAKE_STEP = 0.05
const BRAKE_MAX = 1
const STEER_ANGLE = Math.PI / 8

interface FamilyCarProps {
  input: InputManager
  debug?: boolean
}

export const FamilyCar = ({ input, debug }: FamilyCarProps) => {
  const body = useRef<RapierRigidBody>(null)
  const vcRef = useRef<DynamicRayCastVehicleController | null>(null)
  const debugSet = useDebugStore((s) => s.set)
  const { world } = useRapier()

  const accelForce = useRef(0)
  const brakeForce = useRef(0)

  const { scene } = useGLTF('/cars/family-car.glb')
  const model = useMemo(() => {
    const clone = scene.clone()
    clone.traverse((child: any) => {
      if (child.isMesh) { child.castShadow = true; child.receiveShadow = true }
    })
    return clone
  }, [scene])

  useMemo(() => {
    model.traverse((child: any) => {
      if (child.isMesh) {
        child.material = child.material.clone()
        child.material.transparent = !!debug
        child.material.opacity = debug ? 0.25 : 1
      }
    })
  }, [model, debug])

  useEffect(() => {
    return () => {
      if (vcRef.current) {
        world.removeVehicleController(vcRef.current)
        vcRef.current = null
      }
    }
  }, [world])

  useFrame((_, delta) => {
    const rb = body.current
    if (!rb) return

    // Lazy-init vehicle controller
    if (!vcRef.current) {
      const vc = world.createVehicleController(rb)
      for (let i = 0; i < 4; i++) {
        const p = WHEEL_POSITIONS[i]
        vc.addWheel(
          { x: p.x, y: p.y, z: p.z },
          { x: 0, y: -1, z: 0 },
          { x: -1, y: 0, z: 0 },
          SUSPENSION_REST,
          WHEEL_RADIUS,
        )
        vc.setWheelSuspensionStiffness(i, SUSPENSION_STIFFNESS)
        vc.setWheelSuspensionCompression(i, SUSPENSION_COMPRESSION_DAMPING)
        vc.setWheelSuspensionRelaxation(i, SUSPENSION_RELAXATION_DAMPING)
        vc.setWheelFrictionSlip(i, FRICTION_SLIP)
      }
      // Front wheels steer — start at zero
      vc.setWheelSteering(0, 0)
      vc.setWheelSteering(1, 0)
      vcRef.current = vc
    }

    const vc = vcRef.current
    const { forward, backward: brake, left, right: rightInput, drift } = input.getState()

    // --- Accelerate (exact reference logic) ---
    let accelerateForce = 0
    if (forward) {
      accelerateForce = accelForce.current - ACCEL_STEP
      if (accelerateForce < -ACCEL_MAX) accelerateForce = -ACCEL_MAX
    } else if (brake) {
      accelerateForce = accelForce.current + ACCEL_STEP
      if (accelerateForce > ACCEL_MAX) accelerateForce = ACCEL_MAX
    } else {
      rb.wakeUp()
    }
    accelForce.current = accelerateForce

    // Engine on all 4 wheels (AWD) — prevents pitch torque when only
    // front or rear wheels are grounded
    const perWheel = accelerateForce * 0.5
    for (let i = 0; i < 4; i++) vc.setWheelEngineForce(i, perWheel)

    // --- Steering (exact reference logic) ---
    const steerDirection = (left ? 1 : 0) + (rightInput ? -1 : 0)
    const currentSteering = vc.wheelSteering(0) || 0
    const steering = MathUtils.lerp(currentSteering, STEER_ANGLE * steerDirection, 0.25)
    vc.setWheelSteering(0, steering)
    vc.setWheelSteering(1, steering)

    // --- Brake (exact reference logic) ---
    let bForce = 0
    if (drift) {
      bForce = brakeForce.current + BRAKE_STEP
      if (bForce > BRAKE_MAX) bForce = BRAKE_MAX
    }
    brakeForce.current = bForce
    const wheelBrake = drift ? 1 : 0 * bForce
    for (let i = 0; i < 4; i++) vc.setWheelBrake(i, wheelBrake)

    // --- Step (reference uses fixed 1/60) ---
    vc.updateVehicle(1 / 60)

    // --- Anti-roll bars (per axle) ---
    // Read suspension force difference between left/right wheels,
    // apply corrective torque around the car's forward axis.
    // This is what a physical sway bar does — no artificial forces.
    const rot = rb.rotation()
    const quat = new Quaternion(rot.x, rot.y, rot.z, rot.w)
    const fwd = new Vector3(0, 0, 1).applyQuaternion(quat)

    const MAX_ANTI_ROLL_TORQUE = 30
    for (const [l, r] of [[0, 1], [2, 3]] as const) {
      const lf = (vc.wheelIsInContact(l) ? vc.wheelSuspensionForce(l) : 0) ?? 0
      const rf = (vc.wheelIsInContact(r) ? vc.wheelSuspensionForce(r) : 0) ?? 0
      const diff = MathUtils.clamp((rf - lf) * ANTI_ROLL_STIFFNESS, -MAX_ANTI_ROLL_TORQUE, MAX_ANTI_ROLL_TORQUE)
      if (Math.abs(diff) > 0.01) {
        rb.addTorque({ x: fwd.x * diff, y: fwd.y * diff, z: fwd.z * diff }, true)
      }
    }

    rb.wakeUp()

    // --- Debug ---
    const speed = Math.abs(vc.currentVehicleSpeed())
    const euler = new Euler().setFromQuaternion(new Quaternion(rot.x, rot.y, rot.z, rot.w), 'XYZ')
    const lv = rb.linvel()
    debugSet({
      speed: +speed.toFixed(1),
      forward, braking: brake, left, right: rightInput, drift,
      grounded: vc.wheelIsInContact(0) || vc.wheelIsInContact(1) ||
                vc.wheelIsInContact(2) || vc.wheelIsInContact(3),
      rotX: +MathUtils.radToDeg(euler.x).toFixed(1),
      rotY: +MathUtils.radToDeg(euler.y).toFixed(1),
      rotZ: +MathUtils.radToDeg(euler.z).toFixed(1),
      velX: +lv.x.toFixed(2), velY: +lv.y.toFixed(2), velZ: +lv.z.toFixed(2),
      velMag: +Math.sqrt(lv.x * lv.x + lv.y * lv.y + lv.z * lv.z).toFixed(2),
      fl: vc.wheelIsInContact(0),
      fr: vc.wheelIsInContact(1),
      rl: vc.wheelIsInContact(2),
      rr: vc.wheelIsInContact(3),
      steerAngle: +steering.toFixed(2),
      sideImp: [0,1,2,3].map(i => (vc.wheelSideImpulse(i) ?? 0).toFixed(1)).join(','),
      fwdImp: [0,1,2,3].map(i => (vc.wheelForwardImpulse(i) ?? 0).toFixed(1)).join(','),
      suspF: [0,1,2,3].map(i => (vc.wheelSuspensionForce(i) ?? 0).toFixed(1)).join(','),
    })
  })

  return (
    <RigidBody
      ref={body}
      colliders={false}
      mass={CHASSIS_MASS}
      linearDamping={1}
      angularDamping={1}
      position={[0, 2, 0]}
      ccd
      name="car"
    >
      <CuboidCollider args={[...CHASSIS_HALF]} position={[0, -0.3, 0]} friction={0.8} />
      <primitive object={model} scale={0.5} rotation={[0, Math.PI, 0]} position={[0, -1, 0]} />
    </RigidBody>
  )
}

useGLTF.preload('/cars/family-car.glb')
